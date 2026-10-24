import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {Country,Entry,Feature,Place} from './types';
import {dateLabel} from './types';
import {countryPath,popupPosition,project} from './mapGeometry';

type Preview={kind:'country'|'place';id:string;name:string;x:number;y:number;pinned:boolean};
type Props={countries:Country[];entries:Entry[];selected:string;onSelect:(code:string,name?:string)=>void;onOpenMemory:(id:string)=>void;search:string};

function ExpandIcon({close=false}:{close?:boolean}) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">{close?<path d="m6 6 12 12M6 18 18 6"/>:<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>}</svg>
}

export function WorldMap({countries,entries,selected,onSelect,onOpenMemory,search}:Props) {
  const [features,setFeatures]=useState<Feature[]>([]),[error,setError]=useState(false),[hover,setHover]=useState('');
  const [expanded,setExpanded]=useState(false),[popouts,setPopouts]=useState(true),[preview,setPreview]=useState<Preview|null>(null);
  const mapRoot=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),expandButton=useRef<HTMLButtonElement>(null);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),nativeFullscreen=useRef(false);
  const popout=useRef<HTMLElement>(null),trigger=useRef<Element|null>(null),skipFocus=useRef(false);
  const gradientId=useId().replaceAll(':','');
  useEffect(()=>{const abort=new AbortController();fetch('/world.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>setFeatures(d.features)).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>abort.abort();},[]);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  const paths=useMemo(()=>features.filter(f=>f.properties.code!=='AQ').map(f=>({...f,d:countryPath(f)})),[features]);
  const places=countries.flatMap(c=>c.places),visited=new Set(entries.map(e=>e.country)),visitedPlaces=new Set(entries.map(e=>e.place_id));
  const markers=places.filter(p=>visitedPlaces.has(p.id)||p.country===selected);

  function cancelClose(){if(closeTimer.current)clearTimeout(closeTimer.current);}
  function scheduleClose(){cancelClose();closeTimer.current=setTimeout(()=>setPreview(p=>p?.pinned?p:null),260);}
  function show(kind:Preview['kind'],id:string,name:string,target:Element,x?:number,y?:number,pinned=false) {
    cancelClose();setHover(name);trigger.current=target;
    if(!popouts)return;
    if(preview?.pinned&&!pinned)return;
    const root=mapRoot.current?.getBoundingClientRect(),bounds=target.getBoundingClientRect();
    if(!root)return;
    setPreview({kind,id,name,pinned,x:(x||bounds.left+bounds.width/2)-root.left,y:(y||bounds.top+bounds.height/2)-root.top});
    if(pinned)requestAnimationFrame(()=>popout.current?.focus());
  }
  function dismissPreview(){
    cancelClose();setPreview(null);
    const target=trigger.current;
    if(target&&'focus' in target&&typeof target.focus==='function'){skipFocus.current=true;target.focus();}
  }
  function closeExpanded(){
    nativeFullscreen.current=false;
    if(document.fullscreenElement===dialog.current)void document.exitFullscreen().catch(()=>{});
    dialog.current?.close();setExpanded(false);setPreview(null);
    requestAnimationFrame(()=>expandButton.current?.focus());
  }
  useEffect(()=>{function change(){if(nativeFullscreen.current&&!document.fullscreenElement)closeExpanded();}document.addEventListener('fullscreenchange',change);return()=>document.removeEventListener('fullscreenchange',change);},[]);
  function openExpanded(){
    setPreview(null);setExpanded(true);dialog.current?.showModal();
    if(dialog.current?.requestFullscreen)void dialog.current.requestFullscreen().then(()=>{nativeFullscreen.current=true;}).catch(()=>{});
  }
  function openMemory(id:string){if(expanded)closeExpanded();setPreview(null);onOpenMemory(id);}
  const previewPlace=preview?.kind==='place'?places.find(p=>p.id===preview.id):undefined;
  const previewCountry=preview?.kind==='country'?countries.find(c=>c.code===preview.id):countries.find(c=>c.code===previewPlace?.country);
  const previewEntries=entries.filter(e=>previewPlace?e.place_id===previewPlace.id:e.country===preview?.id);
  const previewPlaces=previewPlace?[previewPlace]:previewCountry?.places||[];
  const position=preview&&mapRoot.current?popupPosition(mapRoot.current.clientWidth,mapRoot.current.clientHeight,preview.x,preview.y):undefined;

  const stage=<div className={`world-wrap ${expanded?'expanded-map':''}`} ref={mapRoot} onMouseLeave={()=>{setHover('');scheduleClose();}} onKeyDown={e=>{if(e.key==='Escape'&&preview){e.preventDefault();e.stopPropagation();dismissPreview();}}}>
    <div className="map-toolbar"><span className="map-caption"><i className="live-dot"/>YOUR PERSONAL ATLAS</span><div className="map-controls"><button className={`map-control ${popouts?'enabled':''}`} aria-pressed={popouts} onClick={()=>{setPopouts(!popouts);setPreview(null);}}><span aria-hidden="true">◈</span>Pop-out previews</button><button ref={expanded?undefined:expandButton} className="map-control" aria-label={expanded?'Exit fullscreen map':'Open fullscreen map'} onClick={expanded?closeExpanded:openExpanded}><ExpandIcon close={expanded}/>{expanded?'Exit full screen':'Full screen'}</button></div></div>
    {expanded&&<div className="expanded-map-heading"><span className="eyebrow">A BIGGER WORLD TO WANDER</span><h2>Let your curiosity <em>take the lead.</em></h2><p>Hover a country or a glowing pin. Click to keep a preview open. Esc brings you back.</p></div>}
    {error?<p role="alert">The bundled map could not load. Use the country selector below.</p>:<svg viewBox="0 0 1000 470" className="world-map" role="group" aria-label="Interactive world map. Hover, focus, or select a country or place to explore." onMouseLeave={scheduleClose}>
      <defs><radialGradient id={gradientId}><stop stopColor="#187bd1"/><stop offset="1" stopColor="#074782"/></radialGradient></defs>
      <rect width="1000" height="470" fill={`url(#${gradientId})`} onClick={()=>setPreview(null)}/>
      <g className="graticule">{[-60,-30,0,30,60].map(lat=><path key={lat} d={`M0 ${project(0,lat)[1]} H1000`}/>)}{[-150,-90,-30,30,90,150].map(lon=><path key={lon} d={`M${project(lon,0)[0]} 0 V470`}/>)}</g>
      {paths.map(f=>{const {code,name}=f.properties;const matches=!search||name.toLowerCase().includes(search.toLowerCase());return <path key={f.properties.code3} d={f.d} tabIndex={0} role="button" aria-label={`${name}, ${visited.has(code)?'visited':'not visited'}`} aria-pressed={selected===code} className={`country ${visited.has(code)?'visited':''} ${selected===code?'selected':''} ${matches?'':'dimmed'}`}
        onMouseEnter={e=>{onSelect(code,name);show('country',code,name,e.currentTarget,e.clientX,e.clientY);}} onMouseLeave={scheduleClose}
        onFocus={e=>{if(skipFocus.current){skipFocus.current=false;return;}onSelect(code,name);show('country',code,name,e.currentTarget);}}
        onBlur={e=>{if(!mapRoot.current?.contains(e.relatedTarget as Node))scheduleClose();}}
        onClick={e=>{onSelect(code,name);show('country',code,name,e.currentTarget,e.clientX,e.clientY,true);}}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(code,name);show('country',code,name,e.currentTarget,undefined,undefined,true);}}}><title>{name} · {visited.has(code)?'Visited':'Yet to explore'}</title></path>;})}
      <g className="journey-lines"><path d="M705 167 Q650 110 539 119"/><path d="M705 167 Q785 110 877 138"/></g>
      {markers.map(p=>{const [x,y]=project(p.lon,p.lat);const isVisited=visitedPlaces.has(p.id);return <g key={p.id} transform={`translate(${x},${y})`} className={`map-marker ${isVisited?'memory-marker':'attraction-marker'}`} tabIndex={0} role="button" aria-label={`${p.name}, ${isVisited?'view your memories':'explore attraction'}`}
        onMouseEnter={e=>show('place',p.id,p.name,e.currentTarget,e.clientX,e.clientY)} onMouseLeave={scheduleClose}
        onFocus={e=>{if(skipFocus.current){skipFocus.current=false;return;}show('place',p.id,p.name,e.currentTarget);}} onBlur={e=>{if(!mapRoot.current?.contains(e.relatedTarget as Node))scheduleClose();}}
        onClick={e=>show('place',p.id,p.name,e.currentTarget,e.clientX,e.clientY,true)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show('place',p.id,p.name,e.currentTarget,undefined,undefined,true);}}}>
        <circle r="14" className="marker-halo"/><circle r="5" className="marker-dot"/><text x="12" y="4">{p.name}</text><title>{p.name}</title></g>;})}
      <text x="175" y="175" className="ocean-label">PACIFIC OCEAN</text><text x="390" y="260" className="ocean-label">ATLANTIC</text><text x="700" y="335" className="ocean-label">INDIAN OCEAN</text>
    </svg>}
    <div className="map-bottom"><span className="map-hover" aria-live="polite">{hover||'A whole world. Your own story.'}</span><div className="legend"><span><i className="legend-visited"/>Visited</span><span><i className="legend-unvisited"/>Yet to explore</span><span><i className="legend-planned"/>Hover / selected</span></div></div>
    <p className="map-credit">Natural Earth · Generalized boundaries; some small territories are not represented. Pins and discovery cards cover the five workshop countries.</p>
    {popouts&&preview&&<section className="map-popout" ref={popout} tabIndex={-1} role="region" aria-label={`${preview.name} preview`} style={position} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} onFocus={cancelClose} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))scheduleClose();}}>
      <div className="popout-top"><span className="eyebrow">{previewEntries.length?'SOMEWHERE YOU’VE BEEN':'SOMEWHERE YOU COULD GO'}</span><button className="icon-button" aria-label="Close place preview" onClick={dismissPreview}><ExpandIcon close/></button></div>
      {previewPlace&&<img className="popout-cover" src={previewPlace.image} alt={`Illustration inspired by ${previewPlace.name}`}/>}
      <h3>{preview.name}</h3><p className="popout-subtitle">{previewPlace?.description||previewCountry?.subtitle||'A new corner of the world to discover.'}</p>
      {previewEntries.length>0&&<div className="popout-memories"><p className="eyebrow">YOUR MEMORIES</p>{previewEntries.map(e=><button key={e.id} className="popout-memory" onClick={()=>openMemory(e.id)}><span><strong>{e.title}</strong><small>{dateLabel(e.visited_on)}</small></span><span aria-hidden="true">↗</span></button>)}</div>}
      {previewPlaces.length>0?<div className="popout-attractions"><p className="eyebrow">{previewPlace?'WHEN TO GO':'A FEW PLACES TO START'}</p>{previewPlaces.map((p:Place)=><a className="popout-attraction" key={p.id} href={p.source} target="_blank" rel="noreferrer">{!previewPlace&&<img src={p.image} alt=""/>}<span><strong>{p.name}</strong><small>{p.season}</small></span><span aria-hidden="true">↗</span></a>)}<p className="popout-disclaimer">Illustrated previews · Seasonal notes are unverified. Links open official tourism sites.</p></div>:<p className="popout-empty">No curated attractions here yet. Explore Japan, India, Italy, France, or Thailand for workshop previews.</p>}
      <button className="popout-pin" aria-pressed={preview.pinned} onClick={()=>setPreview(p=>p?{...p,pinned:!p.pinned}:p)}>{preview.pinned?'◈ Kept open — click to unpin':'◈ Keep this preview open'}</button>
    </section>}
  </div>;

  return <>{!expanded&&stage}<dialog ref={dialog} className="fullscreen-map-dialog" aria-label="Fullscreen personal atlas" onCancel={e=>{e.preventDefault();closeExpanded();}}>{expanded&&stage}</dialog></>;
}
