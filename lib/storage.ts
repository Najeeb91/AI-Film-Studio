import { put } from '@vercel/blob'
export type MediaKind='video'|'audio'|'image'|'subtitle'
export type MediaAssetRef={id:string;kind:MediaKind;uri:string;mimeType?:string;sizeBytes?:number;createdAt:string}
export function isDataUri(uri:string){return uri.startsWith('data:')}
export function isHttpUri(uri:string){return /^https?:\/\//i.test(uri)}
export function assertDurableMediaUri(uri:string){if(!uri) throw new Error('Missing media URI.'); if(isDataUri(uri)) return {durable:false,reason:'data-uri'}; if(isHttpUri(uri)) return {durable:true,reason:'url'}; return {durable:true,reason:'file'}}
export async function storeRemoteMedia(url:string,pathname:string,contentType?:string){
  const r=await fetch(url); if(!r.ok) throw new Error(`Media download failed: ${r.status}`)
  const blob=await r.blob();
  const saved=await put(pathname,blob,{access:'public',contentType:contentType||blob.type||undefined,addRandomSuffix:false})
  return saved.url
}
