/* Real NASA source data and deliberately separate, configurable game simulation. */
const LunarScience = (() => {
  const balance = {
    roverSpeedMPerHour: 1800, astronautSpeedMPerHour: 1000, surveyHours: .25,
    crewOxygenPerHour: 1.15, suitOxygenPerHour: 2.6, baseEnergyPerHour: 1.2,
    roverEnergyPerKm: 1.8, suitEnergyPerKm: 2.1, equipmentEnergy: 2,
    ascentEnergyPer100M: .5, shieldedRadiationPerHour: .5, outsideRadiationPerHour: 2.3,
    environmentIndex: 1, riskDistancePerKm: .008, riskSlopePerDeg: .002,
    riskReliefPer100M: .006, maxRisk: .45
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function estimate(route, mode, c = balance) {
    const astronaut = mode === 'astronaut';
    const km = route.distanceM * 2 / 1000;
    const hours = route.distanceM * 2 / (astronaut ? c.astronautSpeedMPerHour : c.roverSpeedMPerHour)
      * (1 + route.meanSlopeDeg / 20) + c.surveyHours;
    const oxygen = hours * (5 * c.crewOxygenPerHour + (astronaut ? c.suitOxygenPerHour : 0));
    const energy = hours * c.baseEnergyPerHour + km * (astronaut ? c.suitEnergyPerKm : c.roverEnergyPerKm)
      * (1 + route.meanSlopeDeg / 15) + (route.ascentM + route.descentM) / 100 * c.ascentEnergyPer100M + c.equipmentEnergy;
    const radiation = hours * (c.shieldedRadiationPerHour + (astronaut ? c.outsideRadiationPerHour : 0)) * c.environmentIndex;
    const roverRisk = clamp(route.referenceRisk + route.distanceM / 1000 * c.riskDistancePerKm
      + route.maxSlopeDeg * c.riskSlopePerDeg + route.reliefM / 100 * c.riskReliefPer100M, 0, c.maxRisk);
    const risk = astronaut ? clamp(roverRisk * .6, 0, .3) : roverRisk;
    return { mode, hours, km, oxygen, energy, radiation, risk, roverRisk, delta: [-Math.ceil(energy), -Math.ceil(oxygen), Math.ceil(radiation)] };
  }
  function outcome(route, mode, rng = Math.random) {
    const plan = estimate(route, mode);
    const failed = rng() < plan.risk;
    // Observations transmit only at destination. Failures occur on the outbound leg.
    const failureProgress = failed ? .15 + rng() * .65 : 1;
    const fraction = failed ? (mode === 'rover' ? failureProgress / 2 : failureProgress) : 1;
    const elapsedHours = failed ? (plan.hours - balance.surveyHours) * fraction : plan.hours;
    const durationFraction = elapsedHours / plan.hours;
    const delta = [-Math.ceil(plan.energy * durationFraction), -Math.ceil(plan.oxygen * durationFraction), Math.ceil(plan.radiation * durationFraction)];
    return { ...plan, failed, failureProgress, fraction, elapsedHours, delta,
      status: failed ? mode === 'rover' ? 'Señal perdida · rover no disponible' : 'Retirada de emergencia · astronauta a salvo' : 'Reconocimiento completado',
      observations: !failed, roverAvailable: !(failed && mode === 'rover') };
  }
  function pointAt(route, progress) {
    const distance = clamp(progress, 0, 1) * route.distanceM;
    const points = route.points;
    let i = points.findIndex(p => p[4] >= distance);
    if (i <= 0) return points[i === 0 ? 0 : points.length - 1].slice(0, 2);
    const a = points[i - 1], b = points[i];
    const t = (distance - a[4]) / (b[4] - a[4]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return { balance, estimate, outcome, pointAt };
})();
if (typeof module !== 'undefined') module.exports = LunarScience;
