/* Game balance in resource points. NASA measurements retain their physical units. */
const MarsScience = (() => {
  const balance = {
    roverSpeedMPerHour: 2000, roverEnergyPerKm: 3.6, baseEnergyPerHour: 1.2,
    crewOxygenPerHour: 175 / 60, radiationPerHour: 1.1,
    equipmentEnergy: 2, advancedAnalysisEnergy: 2.5,
    dustBaseHours: 1.25, panelAreaM2: 8, panelEfficiency: .2,
    maintenanceEnergy: 6, maintenanceHours: .5, minimumTransmission: .4,
    oxygenGramsPerPoint: 60, crewOxygenGramsPerHour: 175, energyWhPerPoint: 100,
    oxygenSupportEnergyPerHour: .55
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rounded = v => Math.round(v * 10) / 10;
  function routePlan(route) {
    const advanced = route.id === 'long';
    const km = 2 * route.distanceM / 1000;
    const hours = km * 1000 / balance.roverSpeedMPerHour * (1 + route.meanSlopeDeg / 12)
      + (advanced ? .4 : .3);
    const energy = balance.equipmentEnergy + km * balance.roverEnergyPerKm
      + hours * balance.baseEnergyPerHour + (route.ascentM + route.descentM) * .015
      + (advanced ? balance.advancedAnalysisEnergy : 0);
    const risk = clamp(.025 + km * .022 + route.maxSlopeDeg * .006, .02, .4);
    return { hours, km, risk, advanced, delta: [-rounded(energy), -rounded(hours * balance.crewOxygenPerHour), rounded(hours * balance.radiationPerHour)] };
  }
  function terrainResult(route, rng = Math.random) {
    const plan = routePlan(route);
    const delayed = rng() < plan.risk;
    const factor = delayed ? 1.08 + rng() * .16 : 1;
    return { ...plan, delayed, hours: plan.hours * factor, success: true,
      mapping: plan.advanced ? 'detailed' : 'basic', delta: plan.delta.map(v => rounded(v * factor)) };
  }
  function dustScenario(measurement, rng = Math.random) {
    // Dust opacity and panel deposition are scenario inputs, never MEDA measurements.
    const opacity = .12 + rng() * 1.35;
    const deposition = .12 + rng() * .4;
    const transmission = Math.exp(-opacity);
    const irradiance = measurement.irradiance * transmission;
    const solarW = irradiance * balance.panelAreaM2 * balance.panelEfficiency * (1 - deposition);
    return { measurement, opacity, deposition, transmission, irradiance, solarW,
      level: transmission < .4 ? 'high' : transmission < .7 ? 'moderate' : 'low',
      maintenanceAllowed: transmission >= balance.minimumTransmission,
      maintenanceChance: clamp(.35 + transmission * .55 - deposition * .3, .15, .9) };
  }
  function dustPlan(scenario, option) {
    if (option !== 0 && option !== 1) return null;
    if (option === 1 && !scenario.maintenanceAllowed) return null;
    const hours = balance.dustBaseHours + scenario.opacity * .3 + (option === 1 ? balance.maintenanceHours : 0);
    const energy = hours * (option === 0 ? 2.8 : 3.6) + (option === 1 ? balance.maintenanceEnergy : 0);
    return { hours, option, chance: option === 1 ? scenario.maintenanceChance : 1,
      delta: [-rounded(energy), -rounded(hours * balance.crewOxygenPerHour), rounded(hours * balance.radiationPerHour)] };
  }
  function dustResult(scenario, option, rng = Math.random) {
    const plan = dustPlan(scenario, option);
    if (!plan) return null;
    const repaired = option === 1 && rng() < plan.chance;
    const recoveredW = repaired ? scenario.irradiance * balance.panelAreaM2 * balance.panelEfficiency * scenario.deposition * .65 : 0;
    return { ...plan, success: option === 0 || repaired, repaired, recoveredW,
      solarW: scenario.solarW + recoveredW, delta: plan.delta };
  }
  function oxygenPlan(record, option, recoveredW = 0) {
    if (option !== 0 && option !== 1) return null;
    const produce = option === 0;
    const hours = record.cycleHours;
    const generatedG = produce ? record.producedG : 0;
    const extraEnergy = produce ? record.energyWh / balance.energyWhPerPoint : 0;
    const support = hours * balance.oxygenSupportEnergyPerHour;
    const recovery = Math.min(support + extraEnergy, recoveredW * hours / balance.energyWhPerPoint);
    const oxygenUsedG = hours * balance.crewOxygenGramsPerHour;
    return { option, hours, generatedG, oxygenUsedG, energyRecovered: recovery,
      energyWh: produce ? record.energyWh : 0,
      delta: [-rounded(Math.max(0, support + extraEnergy - recovery)),
        -rounded((oxygenUsedG - generatedG) / balance.oxygenGramsPerPoint), rounded(hours * balance.radiationPerHour)] };
  }
  function canAfford(resources, plan) {
    return Boolean(plan) && resources[0] + plan.delta[0] >= 0 && resources[1] + plan.delta[1] > 0;
  }
  return { balance, routePlan, terrainResult, dustScenario, dustPlan, dustResult, oxygenPlan, canAfford, rounded };
})();
if (typeof module !== 'undefined') module.exports = MarsScience;
