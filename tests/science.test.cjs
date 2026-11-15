const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const science=require('../science.js');
const data=require('../data/nasa/routes.json');
const wmts=require('../data/nasa/wmts.json');
assert.equal(data.routes.length,4);
let previous=0;
for(const r of data.routes) {
  assert.deepEqual(r.points[0].slice(0,2),data.baseXY);
  assert(Math.abs(r.distanceM-r.targetDistanceM)<20);
  assert(r.maxSlopeDeg<=r.targetSlopeMaxDeg);
  let measured=0;
  for(let i=0;i<r.points.length;i++) {
    const [x,y,z,s,d]=r.points[i];
    assert([x,y,z,s,d].every(Number.isFinite));
    assert(x>=data.bounds[0]&&x<=data.bounds[2]&&y>=data.bounds[1]&&y<=data.bounds[3]);
    assert(s<=r.targetSlopeMaxDeg);
    if(i) {const step=Math.hypot(x-r.points[i-1][0],y-r.points[i-1][1]);assert(step<=5.002);measured+=step;}
    assert(Math.abs(d-measured)<.05);
    // Every position maps to an officially retrieved tile at both zoom levels.
    for(const z of ['9','10']) {
      const m=wmts.matrices.find(v=>v.id===z), span=m.resolution*m.tileSize;
      const col=Math.floor((x-m.origin[0])/span),row=Math.floor((m.origin[1]-y)/span);
      assert(wmts.tiles.some(t=>t.z===z&&t.col===col&&t.row===row));
      const px=(x-m.origin[0])/m.resolution-col*256;
      const py=(m.origin[1]-y)/m.resolution-row*256;
      assert(px>=0&&px<256&&py>=0&&py<256);
      assert(Math.abs(m.origin[0]+(col*256+px)*m.resolution-x)<1e-8);
    }
  }
  assert(Math.abs(measured-r.distanceM)<.05);
  const rover=science.estimate(r,'rover'),human=science.estimate(r,'astronaut');
  assert(rover.energy>previous);previous=rover.energy;
  assert(human.oxygen>rover.oxygen&&human.radiation>rover.radiation);
  for(const mode of ['rover','astronaut']) {
    const success=science.outcome(r,mode,()=>.999);
    assert(!success.failed&&success.observations&&success.roverAvailable);
    const failure=science.outcome(r,mode,()=>0);
    assert(failure.failed&&!failure.observations);
    assert.equal(failure.roverAvailable,mode==='astronaut');
    assert(failure.elapsedHours<success.elapsedHours);
    failure.delta.forEach((v,i)=>assert(Math.abs(v)<=Math.abs(success.delta[i])));
    assert.deepEqual(science.pointAt(r,0),r.points[0].slice(0,2));
    assert(Math.hypot(...science.pointAt(r,1).map((v,i)=>v-r.points.at(-1)[i]))<.02);
  }
}
for(const t of wmts.tiles) {
 const bytes=fs.readFileSync(require('node:path').join(__dirname,'..',t.file));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),t.sha256);
 assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),256);
}
console.log('PASS: four georeferenced routes, all samples, tile hashes, resource estimates, success and failure, distance-based animation.');
