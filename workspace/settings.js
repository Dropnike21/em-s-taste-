import {db,$,dateNext,msg} from "./shared.js";
import {doc,getDoc,setDoc,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
export async function refreshSettings(){
 const snap=await getDoc(doc(db,"settings","storefront")),s=snap.exists()?snap.data():{};
 $("#orders-open").checked=s.ordersOpen===true;
 $("#menu-service-date").value=s.menuDate?.toDate?s.menuDate.toDate().toISOString().slice(0,10):dateNext();
}
export function initSettings(){
 $("#settings-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const key=$("#menu-service-date").value;
  const date=new Date(key+"T00:00:00.000Z");
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==key||[0,6].includes(date.getUTCDay())){
   msg("Choose a valid Monday–Friday service date.");return;
  }
  try{
   await setDoc(doc(db,"settings","storefront"),{
    menuDate:Timestamp.fromDate(date),menuDayKey:key,
    ordersOpen:$("#orders-open").checked,updatedAt:serverTimestamp()
   });
   msg("Storefront workday and order availability saved.",true);
  }catch(error){console.error(error);msg("Only admins can change global ordering settings.");}
 });
}
