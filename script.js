// script.js
import { jsPDF } from 'jspdf';

// מתחיל כשה־DOM מוכן
window.addEventListener('DOMContentLoaded', () => {
  onload_clear();
  loadPlans();
  initChart();
  recalc();
});

// פונקציית אתחול ראשונית (הוספת 3 שורות)
function onload_clear() {
  document.getElementById('num').value = 0;
  add(); add(); add();
}

// מיפוי מסלולים
const planInfo = {
  'קבועה צמודה למדד': { desc:'ריבית קבועה; צמודה למדד.', feat:'וודאות בריבית.', risk:'חשיפה למדד.' },
  'קבועה לא צמודה למדד': { desc:'ריבית קבועה; לא צמודה.', feat:'החזר קבוע.', risk:'עמלת פירעון גבוהה.' },
  'משתנה צמודה למדד': { desc:'ריבית משתנה; צמודה.', feat:'עמלת פירעון נמוכה.', risk:'אי-וודאות.' },
  'משתנה לא צמודה למדד': { desc:'ריבית משתנה; לא צמודה.', feat:'עמלת נמוכה.', risk:'אי-וודאות.' },
  'מבוססת פריים': { desc:'פריים + מרווח.', feat:'קרן יורדת.', risk:'חשיפה לפריים.' },
  'צמודה למט\'ח': { desc:'צמודת מט\'ח.', feat:'עמלת נמוכה.', risk:'חשיפה למט\'ח.' }
};

// הפונקציה שמוסיפה שורה חדשה
window.add = () => {
  let num = +document.getElementById('num').value + 1;
  document.getElementById('num').value = num;

  const div = document.createElement('div');
  div.className = 'inputn';

  // כפתור הסרה
  const btnRem = document.createElement('button');
  btnRem.type = 'button'; btnRem.textContent = '×';
  btnRem.className = 'btn btn-red';
  btnRem.onclick = () => { div.remove(); recalc(); };
  div.appendChild(btnRem);

  // select מסלול
  const sel = document.createElement('select');
  sel.id = `maslul${num}`;
  sel.onchange = recalc;
  Object.keys(planInfo).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.text = k;
    sel.appendChild(opt);
  });
  div.appendChild(sel);

  // inputs: princ, term, intr
  [['princ','סכום'],['term','תקופה'],['intr','ריבית']].forEach(([id,ph])=>{
    const inp = document.createElement('input');
    inp.type = id==='princ'?'text':'number';
    inp.id = `${id}${num}`;
    inp.placeholder = ph;
    inp.oninput = recalc;
    div.appendChild(inp);
  });

  // payment, total
  ['payment','total'].forEach(pref=>{
    const inp = document.createElement('input');
    inp.type = 'text'; inp.disabled = true;
    inp.id = `${pref}${num}`;
    inp.placeholder = pref==='payment'?'החזר חודשי':'עלות כוללת';
    div.appendChild(inp);
  });

  document.getElementById('inputs').appendChild(div);
};

// פורמט מספר
function fmt(x){
  return x.toLocaleString('he-IL',{minimumFractionDigits:0});
}

// main recalc
window.recalc = () => {
  const n = +document.getElementById('num').value;
  let totalP=0, totalPay=0, totalCost=0;
  const labels = [], datasets = [];

  for(let j=1;j<=n;j++){
    const princ = +document.getElementById(`princ${j}`).value.replace(/,/g,'')||0;
    const termY = +document.getElementById(`term${j}`).value||0;
    const intr = (+document.getElementById(`intr${j}`).value||0)/100/12;
    const sel  = document.getElementById(`maslul${j}`).value;
    const months = termY*12;
    const pay = intr>0
      ? (princ*intr*Math.pow(1+intr,months))/(Math.pow(1+intr,months)-1)
      : (months>0?princ/months:0);
    const cost = pay*months;

    document.getElementById(`payment${j}`).value = fmt(pay);
    document.getElementById(`total${j}`).value   = fmt(cost);

    totalP   += princ;
    totalPay += pay;
    totalCost+= cost;

    // data for chart
    const cum = Array.from({length:termY+1},(_,y)=>pay*y);
    if(labels.length<termY+1)
      labels.push(...Array(termY+1-labels.length).fill(0).map((_,i)=>labels.length+i+1));
    datasets.push({label:sel,data:cum,fill:false});
  }

  // update summaries
  document.getElementById('totalPrincipal').value = fmt(totalP);
  document.getElementById('totalPayment').value   = fmt(totalPay);
  document.getElementById('totalNominal').value   = fmt(totalCost);
  document.getElementById('oneshekel').value      = (totalCost/totalP||0).toFixed(2);

  // update chart
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();

  savePlans();
};

// ייצוא PDF
document.getElementById('exportPDF').onclick = ()=>{
  const doc = new jsPDF();
  doc.text('תמהיל משכנתא',10,10);
  doc.autoTable({ html:'#inputs', startY:20 });
  doc.save('mortgage_plan.pdf');
};
// ייצוא Excel
document.getElementById('exportExcel').onclick = ()=>{
  const wb = XLSX.utils.table_to_book(document.getElementById('inputs'));
  XLSX.writeFile(wb,'mortgage_plan.xlsx');
};

// Chart.js init
let chart;
function initChart(){
  chart = new Chart(
    document.getElementById('chart_payment3').getContext('2d'),
    {type:'line',data:{labels:[],datasets:[]},options:{responsive:true}}
  );
}

// localStorage save/load
function savePlans(){
  const plans = Array.from(document.querySelectorAll('.inputn')).map(div=>({
    type: div.querySelector('select').value,
    princ:+div.querySelector('input[id^=princ]').value.replace(/,/g,'')||0,
    term:+div.querySelector('input[id^=term]').value||0,
    intr:+div.querySelector('input[id^=intr]').value||0
  }));
  localStorage.setItem('mortgagePlans',JSON.stringify(plans));
}
function loadPlans(){
  const plans = JSON.parse(localStorage.getItem('mortgagePlans')||'[]');
  if(plans.length){
    plans.forEach((p,i)=>{
      add();
      const div = document.querySelectorAll('.inputn')[i];
      div.querySelector('select').value    = p.type;
      div.querySelector('input[id^=princ]').value = p.princ;
      div.querySelector('input[id^=term]').value  = p.term;
      div.querySelector('input[id^=intr]').value  = p.intr;
    });
  }
}

// טופס לידים
document.getElementById('leadForm').onsubmit = e=>{
  e.preventDefault();
  document.getElementById('leadMsg').textContent =
    'בקשתך נרשמה! ניצור איתך קשר בהקדם.';
  e.target.reset();
};
