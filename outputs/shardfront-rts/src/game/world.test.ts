import {describe,it,expect} from 'vitest';
import {findPath,segmentClear,terrainBlocked,RIDGES} from './world';
import {decode,encode} from './storage';
describe('navigation and durable records',()=>{
 it('routes an army through an actual ravine crossing',()=>{const start={x:-18,z:11},goal={x:18,z:11};const path=findPath(start,goal,.8,[]);expect(path.length).toBeGreaterThan(1);let previous=start;for(const next of path){expect(segmentClear(previous,next,.8,[])).toBe(true);previous=next;}expect(path.at(-1)).toEqual(goal);});
 it('avoids building footprints and rejects blocked terrain',()=>{const blockers=[{x:-28,z:0,radius:4}];const path=findPath({x:-40,z:0},{x:-15,z:0},.7,blockers);expect(path.length).toBeGreaterThan(1);for(const p of path)expect(Math.hypot(p.x+28,p.z)).toBeGreaterThan(4.7);expect(terrainBlocked(0,11)).toBe(true);expect(terrainBlocked(0,22)).toBe(false);});
 it('has rotationally symmetric tactical crossings',()=>{for(const ridge of RIDGES)expect(RIDGES.some(r=>r.x===-ridge.x&&r.z===-ridge.z&&r.width===ridge.width&&r.depth===ridge.depth)).toBe(true);});
 it('detects local record corruption without silently accepting it',()=>{const data={score:42,commands:['move','gather']};expect(decode(encode(data))).toEqual(data);expect(()=>decode(encode(data).replace('42','43'))).toThrow('damaged');});
});
