import { leafletCSS, leafletJS } from './vendor';

export type Coordinate = { latitude: number; longitude: number };
export type MapEvent = Coordinate & { id: string; title: string };
export type MapState = {
  center: Coordinate;
  events: MapEvent[];
  userLocation?: Coordinate | null;
  locationFocus?: number;
  coordinate?: Coordinate;
};

export function validCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as Coordinate;
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180;
}

// Escape HTML delimiters even though updates are injected as JavaScript, not markup.
export function serializeMapState(state: MapState) {
  return JSON.stringify(state).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function createMapHTML(picker: boolean) {
  const config = JSON.stringify({ picker }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${leafletCSS}
html,body,#map{height:100%;width:100%;margin:0;background:#202020}
.leaflet-container{font-family:system-ui;background:#202020}
.leaflet-bottom{bottom:24px}
.leaflet-control-attribution{font-size:9px!important;background:#111d!important;color:#ccc}
.leaflet-control-attribution a{color:#ccc}
.leaflet-bar a{background:#151515;color:white;border-color:#444}
.event-pin,.user-pin{box-sizing:border-box;border:3px solid #111;border-radius:50%;background:#ffae00;color:#111;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px #0009}
.user-pin{background:#ff7900;border:3px solid white;box-shadow:0 0 0 7px #ff790044}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#151515;color:white}
.cluster-choice{display:block;width:100%;padding:12px;color:white;background:#222;border:1px solid #444;text-align:left;border-radius:6px;margin:4px 0}
#notice{display:none;position:absolute;z-index:1000;left:12px;right:12px;top:12px;background:#111e;color:white;padding:10px;border-radius:8px;font:12px system-ui}
</style></head><body><div id="map"></div><div id="notice" role="status"></div>
<script>${leafletJS}</script><script>
(function(){
'use strict';
var config=${config}, map, state, lastEventsKey=null, lastFocus=null, picked=null, user=null;
function send(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));}
function notice(text){var el=document.getElementById('notice');el.textContent=text;el.style.display=text?'block':'none';}
try{
map=L.map('map',{zoomControl:false,worldCopyJump:false,minZoom:2,maxZoom:19,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1}).setView([-34.6037,-58.3816],12);
L.control.zoom({position:'bottomleft'}).addTo(map);
map.attributionControl.setPosition('bottomright');
var eventsLayer=L.layerGroup().addTo(map);
var tileErrors=0;
var tiles=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
 attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
 maxZoom:19,noWrap:true,keepBuffer:2
}).addTo(map);
tiles.on('tileerror',function(){
 tileErrors++;
 if(tileErrors>=3){notice('No se pudo cargar el mapa. Revisa tu conexion y toca Reintentar.');send({type:'tilesError'});}
});
tiles.on('tileload',function(){tileErrors=0;notice('');send({type:'tilesLoaded'});});
function icon(count,location){
 return L.divIcon({className:location?'user-pin':'event-pin',html:location?'':count>1?String(count):'S',iconSize:location?[24,24]:[42,42],iconAnchor:location?[12,12]:[21,21]});
}
function coords(point){return [point.latitude,point.longitude];}
function renderEvents(){
 eventsLayer.clearLayers();if(!state||config.picker)return;
 var groups=[];
 state.events.forEach(function(event){
   var point=map.latLngToLayerPoint(coords(event)), group=groups.find(function(g){return point.distanceTo(g.point)<52;});
   if(group)group.items.push(event);else groups.push({point:point,items:[event]});
 });
 groups.forEach(function(group){
   var items=group.items, first=items[0];
   var marker=L.marker(coords(first),{icon:icon(items.length,false),title:items.length>1?items.length+' eventos':first.title}).addTo(eventsLayer);
   marker.on('click',function(){
     if(items.length===1){send({type:'select',id:first.id});return;}
     var bounds=L.latLngBounds(items.map(coords));
     if(map.getZoom()<18&&!bounds.getNorthEast().equals(bounds.getSouthWest())){
       map.fitBounds(bounds,{padding:[55,55],maxZoom:18});return;
     }
     var list=document.createElement('div');
     items.forEach(function(item){var button=document.createElement('button');button.className='cluster-choice';button.textContent=item.title;button.onclick=function(){send({type:'select',id:item.id});};list.appendChild(button);});
     marker.bindPopup(list,{maxHeight:200,autoPan:false}).openPopup();
   });
 });
}
map.on('zoomend moveend',renderEvents);
function selectPosition(latlng){
 if(!picked)return;
 picked.setLatLng(latlng);
 send({type:'coordinate',coordinate:{latitude:latlng.lat,longitude:((latlng.lng+180)%360+360)%360-180}});
}
if(config.picker)map.on('click',function(e){selectPosition(e.latlng);});
window.updateSondarMap=function(next){
 state=next;
 if(config.picker&&state.coordinate){
   var target=coords(state.coordinate);
   if(!picked){
     picked=L.marker(target,{draggable:true,icon:icon(1,true),title:'Ubicacion del evento'}).addTo(map);
     picked.on('dragend',function(){selectPosition(picked.getLatLng());});
     map.setView(target,14);
   }else if(!picked.getLatLng().equals(L.latLng(target),0.000001)){
     picked.setLatLng(target);map.panTo(target);
   }
 }else{
   var key=state.events.map(function(e){return e.id+':'+e.latitude+':'+e.longitude;}).sort().join('|');
   if(key!==lastEventsKey){
     lastEventsKey=key;
     if(state.events.length)map.fitBounds(L.latLngBounds(state.events.map(coords)),{paddingTopLeft:[45,70],paddingBottomRight:[45,55],maxZoom:14});
     else map.setView(coords(state.center),12);
   }
   renderEvents();
 }
 if(state.userLocation){
   if(!user)user=L.marker(coords(state.userLocation),{icon:icon(1,true),zIndexOffset:1000,title:'Tu ubicacion'}).addTo(map).bindTooltip('Tu ubicacion');
   else user.setLatLng(coords(state.userLocation));
   if(state.locationFocus&&state.locationFocus!==lastFocus){map.setView(coords(state.userLocation),15);lastFocus=state.locationFocus;}
 }else if(user){map.removeLayer(user);user=null;}
};
new ResizeObserver(function(){map.invalidateSize();}).observe(document.getElementById('map'));
send({type:'ready'});
}catch(error){send({type:'error'});}
})();
</script></body></html>`;
}
