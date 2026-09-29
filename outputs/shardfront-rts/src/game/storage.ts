import type { GameOptions, RecordedCommand } from './types';
export interface SavedMatch { options: GameOptions; serialized:string; date:string }
export interface SavedReplay { options:GameOptions; commands:RecordedCommand[]; duration:number; hash:string; date:string }
export function checksum(value:string):string {let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return(h>>>0).toString(16);}
export function encode(value:unknown):string{const payload=JSON.stringify(value);return JSON.stringify({version:1,payload,checksum:checksum(payload)});}
export function decode<T>(raw:string):T{const item=JSON.parse(raw);if(item.version!==1||typeof item.payload!=='string'||item.checksum!==checksum(item.payload))throw Error('Local record is damaged. Start a new expedition; previous records have not been erased.');return JSON.parse(item.payload)as T;}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open('shardfront-astra',1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function readRecord<T>(key:string):Promise<T|undefined>{
 try{const db=await database();const raw=await new Promise<string|undefined>((resolve,reject)=>{const tx=db.transaction('records');const req=tx.objectStore('records').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});return raw?decode<T>(raw):undefined;}
 catch(error){const fallback=localStorage.getItem(`shardfront.astra.${key}`);if(fallback)return decode<T>(fallback);if(error instanceof Error&&error.message.includes('damaged'))throw error;return undefined;}
}
export async function writeRecord(key:string,value:unknown):Promise<void>{
 const raw=encode(value);try{const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(raw,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
 catch{localStorage.setItem(`shardfront.astra.${key}`,raw);}
}
