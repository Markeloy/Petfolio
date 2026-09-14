import { ImageResponse } from 'next/og';
// Same approved paw and colors as public/petfolio-icon.svg.
export function petfolioIcon(size:number) {
 return new ImageResponse(
  <div style={{display:'flex',width:'100%',height:'100%',background:'#f7f7f8'}}>
   <svg width={size} height={size} viewBox="0 0 512 512">
    <circle cx="256" cy="285" r="92" fill="#716184"/>
    <circle cx="148" cy="185" r="48" fill="#716184"/>
    <circle cx="238" cy="142" r="48" fill="#716184"/>
    <circle cx="328" cy="151" r="48" fill="#716184"/>
    <circle cx="382" cy="227" r="45" fill="#716184"/>
   </svg>
  </div>,{width:size,height:size});
}
