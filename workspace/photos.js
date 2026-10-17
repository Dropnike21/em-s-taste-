// Optional Wikimedia Commons photo picker.
// Images are not auto-attached: staff approve an actual food photo and its credit.
const api="https://commons.wikimedia.org/w/api.php";
const accepted=/^(CC0|CC BY(?:-SA)?(?: [1-4](?:\.\d)?)?)$/i;
function plain(html){
 const documentFragment=new DOMParser().parseFromString(String(html||""),"text/html");
 return (documentFragment.body.textContent||"").replace(/\s+/g," ").trim().slice(0,170);
}
export async function findFoodPhotos(name){
 const params=new URLSearchParams({
  action:"query",format:"json",formatversion:"2",generator:"search",
  gsrnamespace:"6",gsrlimit:"12",
  gsrsearch:String(name).slice(0,85)+" food filetype:bitmap",
  prop:"imageinfo",iiprop:"url|mime|extmetadata",iiurlwidth:"520",
  iiextmetadatafilter:"LicenseShortName|LicenseUrl|Artist|Credit",
  origin:"*"
 });
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 let data;
 try{
  const response=await fetch(api+"?"+params,{signal:controller.signal,cache:"force-cache"});
  if(!response.ok)throw Error("Commons search unavailable");
  data=await response.json();
 }finally{clearTimeout(timer);}
 if(data.error)throw Error("Commons search temporarily unavailable");
 const pages=data.query?.pages||[];
 return pages.flatMap(page=>{
  const info=page.imageinfo?.[0];
  const metadata=info?.extmetadata||{};
  const license=plain(metadata.LicenseShortName?.value);
  if(!accepted.test(license)||!info?.thumburl||!info?.descriptionurl ||
     !/^image\/(jpeg|png|webp)$/i.test(info.mime||""))return [];
  const licenseUrl=metadata.LicenseUrl?.value||"";
  const source=info.descriptionurl;
  if(!source.startsWith("https://commons.wikimedia.org/"))return [];
  return [{
   image:info.thumburl,source,license,licenseUrl,
   credit:plain(metadata.Artist?.value||metadata.Credit?.value)||"Wikimedia Commons contributor",
   title:String(page.title||"").replace(/^File:/,"").slice(0,110)
  }];
 }).slice(0,6);
}
