import {$,esc,peso,msg} from "./shared.js";
import {getOrders} from "./orders.js";
let rows=[];
function cellsFromOrders(){
 const map=new Map();
 for(const order of getOrders()){
  if(!["confirmed","completed"].includes(order.status))continue;
  for(const item of order.items||[]){
   const key=[order.serviceDay||"",order.workplace||"",item.name||""].join("\u001f");
   const current=map.get(key)||{
    date:order.serviceDay||"",workplace:order.workplace||"",
    item:item.name||"",quantity:0,estTotal:0
   };
   current.quantity+=Number(item.quantity||0);
   current.estTotal+=Number(item.quantity||0)*Number(item.unitPrice||0);
   map.set(key,current);
  }
 }
 return [...map.values()].sort((a,b)=>
  a.date.localeCompare(b.date)||a.workplace.localeCompare(b.workplace)||a.item.localeCompare(b.item));
}
export function refreshPrep(){
 rows=cellsFromOrders();
 $("#prep-total").textContent=rows.reduce((sum,r)=>sum+r.quantity,0)+" servings (confirmed/completed)";
 $("#prep-summary").innerHTML=rows.length
  ? '<div class="prep-table-wrap"><table class="prep-table"><thead><tr><th>Meal date</th><th>Workplace</th><th>Dish</th><th>Servings</th><th>Requested value</th></tr></thead><tbody>'+
   rows.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.workplace)+'</td><td>'+esc(x.item)+'</td><td>'+x.quantity+'</td><td>'+peso(x.estTotal)+'</td></tr>').join("")+
   '</tbody></table></div>'
  : '<p class="muted">No confirmed or completed standard orders available for preparation yet. Bulk quotes must be planned separately.</p>';
}
function csvCell(v){let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function initPrep(){
 $("#export-prep").addEventListener("click",()=>{
  if(!rows.length){msg("No confirmed meals to export yet.");return;}
  const content=[["Meal date","Workplace","Dish","Servings","Request amount"]]
   .concat(rows.map(r=>[r.date,r.workplace,r.item,r.quantity,r.estTotal]))
   .map(row=>row.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF",content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ems-taste-kitchen-prep.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  msg("Kitchen preparation sheet exported.",true);
 });
}
