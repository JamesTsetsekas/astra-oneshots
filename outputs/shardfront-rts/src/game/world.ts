import type { Vec2 } from './types';

/** Shared gameplay/render metadata. Three passages cross the basalt ridge. */
export const RIDGES = [
  { x: 0, z: -36, width: 11, depth: 16, height: 4.5 },
  { x: 0, z: -11, width: 9, depth: 10, height: 3.6 },
  { x: 0, z: 11, width: 9, depth: 10, height: 3.6 },
  { x: 0, z: 36, width: 11, depth: 16, height: 4.5 },
];
export const BRIDGES = [-22, 22];
export function terrainBlocked(x: number, z: number, radius = 0): boolean {
  return Math.abs(x) > 59 - radius || Math.abs(z) > 44 - radius || RIDGES.some(r => Math.abs(x-r.x) < r.width/2+radius && Math.abs(z-r.z) < r.depth/2+radius);
}

export interface Blocker extends Vec2 { radius: number }
const CELL = 2, WIDTH = 60, DEPTH = 45;
const point = (index: number): Vec2 => ({ x: index%WIDTH*CELL-59, z: Math.floor(index/WIDTH)*CELL-44 });
const index = (p: Vec2) => Math.max(0,Math.min(DEPTH-1,Math.round((p.z+44)/CELL)))*WIDTH+Math.max(0,Math.min(WIDTH-1,Math.round((p.x+59)/CELL)));
export function navigable(p: Vec2, radius: number, blockers: Blocker[]): boolean {
  return !terrainBlocked(p.x,p.z,radius) && !blockers.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<b.radius+radius+.15);
}
export function segmentClear(a: Vec2, b: Vec2, radius: number, blockers: Blocker[]): boolean {
  const steps = Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.6);
  for(let i=1;i<=steps;i++){const t=i/steps;if(!navigable({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},radius,blockers))return false;}
  return true;
}

/** Bounded A*; no diagonal corner cutting. Cached by the simulation until target/map changes. */
export function findPath(start: Vec2, goal: Vec2, radius: number, blockers: Blocker[]): Vec2[] {
  if(segmentClear(start,goal,radius,blockers))return [{...goal}];
  const valid = new Uint8Array(WIDTH*DEPTH);
  for(let i=0;i<valid.length;i++)valid[i]=navigable(point(i),radius,blockers)?1:0;
  const nearest=(p:Vec2)=>{let best=-1,d=Infinity;for(let i=0;i<valid.length;i++){if(!valid[i])continue;const q=point(i),n=Math.hypot(q.x-p.x,q.z-p.z);if(n<d){d=n;best=i;}}return best;};
  const from=valid[index(start)]?index(start):nearest(start),to=valid[index(goal)]?index(goal):nearest(goal);
  if(from<0||to<0)return [];
  const scores=new Float64Array(valid.length).fill(Infinity),parents=new Int32Array(valid.length).fill(-1),closed=new Uint8Array(valid.length);
  const open=[from];scores[from]=0;
  const heuristic=(i:number)=>{const p=point(i),q=point(to);return Math.hypot(p.x-q.x,p.z-q.z);};
  let found=false;
  while(open.length){let at=0;for(let j=1;j<open.length;j++)if(scores[open[j]]+heuristic(open[j])<scores[open[at]]+heuristic(open[at]))at=j;const current=open.splice(at,1)[0];if(current===to){found=true;break;}closed[current]=1;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const cx=current%WIDTH,cz=Math.floor(current/WIDTH),nx=cx+dx,nz=cz+dz;if(nx<0||nx>=WIDTH||nz<0||nz>=DEPTH)continue;const next=nz*WIDTH+nx;if(!valid[next]||closed[next])continue;if(dx&&dz&&(!valid[cz*WIDTH+nx]||!valid[nz*WIDTH+cx]))continue;const cost=scores[current]+(dx&&dz?2.828:2);if(cost>=scores[next])continue;scores[next]=cost;parents[next]=current;if(!open.includes(next))open.push(next);}
  }
  if(!found)return [];
  const path:Vec2[]=[];let cursor=to;while(cursor!==from&&cursor>=0){path.unshift(point(cursor));cursor=parents[cursor];}
  if(navigable(goal,radius,blockers))path.push({...goal});
  const smooth:Vec2[]=[];let anchor=start;while(path.length){let j=path.length-1;while(j>0&&!segmentClear(anchor,path[j],radius,blockers))j--;anchor=path[j];smooth.push(anchor);path.splice(0,j+1);}return smooth;
}
