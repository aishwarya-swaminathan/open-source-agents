import type {Feature} from './types';

export function project(lon:number,lat:number) { return [(lon+180)*1000/360,(85-lat)*470/170]; }
export function countryPath(feature:Feature) {
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates as number[][][]]:feature.geometry.coordinates as number[][][][];
  return polygons.map(p=>p.map(r=>r.map(([lon,lat],i)=>`${i?'L':'M'}${project(lon,lat).map(n=>n.toFixed(2)).join(',')}`).join(' ')+'Z').join(' ')).join(' ');
}

export function popupPosition(width:number,height:number,x:number,y:number) {
  const popupWidth=Math.max(0,Math.min(316,width-24));
  const popupHeight=Math.max(170,Math.min(410,height-75));
  const desiredLeft=x+22+popupWidth>width-12?x-popupWidth-22:x+22;
  return {left:Math.max(12,Math.min(desiredLeft,width-popupWidth-12)),top:Math.max(48,Math.min(y-15,height-popupHeight-12)),width:popupWidth,maxHeight:popupHeight};
}
