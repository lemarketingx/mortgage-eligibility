// script.js (מודול)
import { jsPDF } from 'jspdf';

// מיפוי של מסלולי ריבית
const planInfo = {
  'קבועה צמודה למדד': {
    desc: 'ריבית קבועה לכל התקופה; צמודה למדד.',
    feat: 'וודאות בריבית; עמלת פירעון גבוהה.',
    risk: 'חשיפה למדד; קרן גדלה באינפלציה.'
  },
  'קבועה לא צמודה למדד': {
    desc: 'ריבית קבועה; לא צמודה למדד.',
    feat: 'החזר קבוע; יציבות מלאה.',
    risk: 'עמלת פירעון גבוהה; קושי למחזור.'
  },
  'משתנה צמודה למדד': {
    desc: 'ריבית משתנה; צמודה למדד.',
    feat: 'עמלת פירעון נמוכה; גמישות.',
    risk: 'חשיפה למדד; אי-וודאות.'
  },
  'משתנה לא צמודה למדד': {
    desc: 'ריבית משתנה; לא צמודה למדד.',
    feat: 'עמלת פירעון נמוכה; גמישות.',
    risk: 'חשיפה לשינויים; אי-וודאות.'
  },
  'מבוססת פריים': {
    desc: 'פריים + מרווח; לא צמודה למדד.',
    feat: 'קרן יורדת תמיד; עמלת פירעון נמוכה.',
    risk: 'חשיפה לשינויים בפריים.'
  },
  'צמודה למט"ח': {
    desc: 'צמודת שער מטבע חוץ.',
    feat: 'עמלת פירעון נמוכה; מתאים להכנסות במט"ח.',
    risk: 'חשיפה לתנודת מט"ח ולליבור.'
  }
};

// DOM references
const tbody = document.querySelector('#inputs');
const summaryEl = document.getElementById('controls');
const chartCtx = document.getElementById('chart_payment3').getContext('2d');
let amortChart;

// בעת טעינת הדף
window.onload = () => {
  onload_clear();
  loadPlans();
  initChart();
  recalc();
};

// add.js → פונקציות להוספה/הסרה
window.onload_clear = () => {
  document.getElementById('num').value = 0;
  add(); add(); add();
};
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

  // בחירת מסלול
  const sel = document.createElement('select');
  sel.id = `maslul${num}`; sel.onchange = recalc;
  for (let k of ['בחר מסלול', ...Object.keys(planInfo)]) {
    const opt = document.createElement('option');
    opt.value = k; opt.text = k;
    sel.appendChild(opt);
  }
  div.appendChild(sel);

  // שדות סכום, תקופה, ריבית
  ['princ','term','intr'].forEach(id => {
    const inp = document.createElement('input');
    inp.type = id==='princ'?'text':'number';
    inp.id = `${id}${num}`; inp.placeholder = {
      princ:'סכום', term:'תקופה', intr:'ריבית'
    }[id];
    inp.oninput = recalc;
    div.appendChild(inp);
  });

  // החזר חודשי ועלות כוללת
  ['payment','total'].forEach(prefix => {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.disabled = true;
    inp.id = `${prefix}${num}`;
    inp.placeholder = prefix==='payment'?'החזר חודשי':'עלות כוללת';
    div.appendChild(inp);
  });

  tbody.appendChild(div);
};

// פורמט מספר עם פסיקים
function formatNum(x) {
  return x.toLocaleString('he-IL', {minimumFractionDigits:0});
}

// פונקציית החישוב הראשית (calc → recalc)
window.recalc = () => {
  const n = +document.getElementById('num').value;
  let totalP=0, totalPay=0, totalCost=0;
  const datasets = [], labels = [];

  for (let j=1; j<=n; j++) {
    const princ = +document.getElementById(`princ${j}`).value.replace(/,/g,'')||0;
    const termY = +document.getElementById(`term${j}`).value||0;
    const intr = (+document.getElementById(`intr${j}`).value||0)/100/12;
    const sel = document.getElementById(`maslul${j}`).value;

    // חישוב החזר חודשי (אמורטיזציה)
    const nMonths = termY*12;
    const pay = intr>0
      ? (princ*intr*Math.pow(1+intr,nMonths))/(Math.pow(1+intr,nMonths)-1)
      : (nMonths>0?princ/nMonths:0);

    const cost = pay * nMonths;
    document.getElementById(`payment${j}`).value = formatNum(pay);
    document.getElementById(`total${j}`).value   = formatNum(cost);

    totalP   += princ;
    totalPay += pay;
    totalCost+= cost;

    // לצורך גרף: צבירת עלות מצטברת
    const cum = Array.from({length:termY+1},(_,y)=> pay*y );
    labels.length<termY+1 && labels.push(...Array(termY+1-labels.length).fill(0).map((_,i)=>labels.length+i+1));
    datasets.push({ label: sel, data: cum, fill:false });
  }

  // סיכומים
  document.getElementById('totalPrincipal').value  = formatNum(totalP);
  document.getElementById('totalPayment').value    = formatNum(totalPay);
  document.getElementById('totalNominal').value    = formatNum(totalCost);
  document.getElementById('oneshekel').value       = (totalCost/totalP||0).toFixed(2);

  // עדכון גרף
  amortChart.data.labels = labels;
  amortChart.data.datasets = datasets;
  amortChart.update();

  // שמירה ב-localStorage
  savePlans();
};

// ייצוא ל-PDF
document.getElementById('exportPDF').onclick = () => {
  const doc = new jsPDF();
  doc.text('תמהיל משכנתא', 10, 10);
  doc.autoTable({ html: '#inputs', startY: 20 });
  doc.save('mortgage_plan.pdf');
};

// ייצוא ל-Excel
document.getElementById('exportExcel').onclick = () => {
  const wb = XLSX.utils.table_to_book(document.getElementById('inputs'));
  XLSX.writeFile(wb, 'mortgage_plan.xlsx');
};

// Chart.js
function initChart() {
  amortChart = new Chart(chartCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: { responsive:true, plugins:{legend:{position:'top'}} }
  });
}

// שמירת ושיחזור תמהיל
function savePlans() {
  const plans = Array.from(document.querySelectorAll('.inputn')).map(div=>({
    type: div.querySelector('select').value,
    princ: +div.querySelector('input[id^=princ]').value.replace(/,/g,'')||0,
    term: +div.querySelector('input[id^=term]').value||0,
    intr: +div.querySelector('input[id^=intr]').value||0
  }));
  localStorage.setItem('mortgagePlans', JSON.stringify(plans));
}
function loadPlans() {
  const plans = JSON.parse(localStorage.getItem('mortgagePlans')||'[]');
  if (plans.length) {
    add(); // מוסיפים מספר שורות שווה ל-plans.length
    for (let i=0; i<plans.length; i++) {
      const div = document.querySelectorAll('.inputn')[i];
      div.querySelector('select').value = plans[i].type;
      div.querySelector('input[id^=princ]').value = plans[i].princ;
      div.querySelector('input[id^=term]').value = plans[i].term;
      div.querySelector('input[id^=intr]').value = plans[i].intr;
    }
  }
}

// טופס לידים (דמה ל-CRM)
document.getElementById('leadForm').onsubmit = e => {
  e.preventDefault();
  document.getElementById('leadMsg').textContent = 'בקשתך נרשמה! ניצור איתך קשר בהקדם.';
  e.target.reset();
};
