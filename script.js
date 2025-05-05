import { jsPDF } from 'jspdf';

// מיפוי מסלולים
const planInfo = {
  'קבועה צמודה למדד': {
    desc: 'ריבית קבועה לכל התקופה; קרן + ריבית צמודים למדד.',
    feat: 'וודאות בריבית; החזר קבוע; עמלת פירעון גבוהה.',
    risk: 'חשיפה למדד; קרן גדלה באינפלציה.'
  },
  'קבועה לא צמודה למדד': {
    desc: 'ריבית קבועה; לא צמוד למדד.',
    feat: 'החזר קבוע; יציבות.',
    risk: 'עמלת פירעון גבוהה; קושי למחזור.'
  },
  'משתנה צמודה למדד': {
    desc: 'ריבית משתנה; קרן + ריבית צמודים למדד.',
    feat: 'עמלת פירעון נמוכה; גמישות.',
    risk: 'חשיפה למדד וריבית; אי-וודאות.'
  },
  'משתנה לא צמודה למדד': {
    desc: 'ריבית משתנה; לא צמוד למדד.',
    feat: 'עמלת פירעון נמוכה; גמישות.',
    risk: 'חשיפה לריבית; אי-וודאות.'
  },
  'מבוססת פריים': {
    desc: 'ריבית = פריים + מרווח; לא צמוד למדד.',
    feat: 'קרן יורדת תמיד; עמלת פירעון נמוכה.',
    risk: 'חשיפה לשינויים בריבית בנק ישראל.'
  },
  'צמודה למט"ח': {
    desc: 'קרן + ריבית צמודים למטבע חוץ.',
    feat: 'עמלת פירעון נמוכה; מתאים למוטבעים.',
    risk: 'חשיפה לשער מטבע ולליבור.'
  }
};

// DOM
const tbody = document.querySelector('#planTable tbody');
const summaryEl = document.getElementById('planSummary');
const chartCtx = document.getElementById('amortChart').getContext('2d');
const leadForm = document.getElementById('leadForm');
const leadMsg = document.getElementById('leadMsg');

// Chart.js instance
let amortChart;

// טעינת תמהיל מ־localStorage
document.addEventListener('DOMContentLoaded', () => {
  loadPlans();
  initChart();
  updateChart();
});

// הוספת שורה
document.getElementById('addPlan').addEventListener('click', () => {
  addPlanRow();
  savePlans();
});

// ייצוא PDF
document.getElementById('exportPDF').addEventListener('click', () => {
  const doc = new jsPDF();
  doc.text('תמהיל משכנתא', 10, 10);
  doc.autoTable({ html: '#planTable', startY: 20 });
  doc.save('mortgage_plan.pdf');
});

// ייצוא Excel
document.getElementById('exportExcel').addEventListener('click', () => {
  const wb = XLSX.utils.table_to_book(document.getElementById('planTable'));
  XLSX.writeFile(wb, 'mortgage_plan.xlsx');
});

// שמירת לידים (דמה ל־CRM)
leadForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    name: leadForm.leadName.value,
    email: leadForm.leadEmail.value,
    plan: JSON.parse(localStorage.getItem('mortgagePlans') || '[]')
  };
  console.log('שולח ל-CRM:', data);
  leadMsg.textContent = 'בקשתך נרשמה! ניצור איתך קשר בהקדם.';
  leadForm.reset();
});

// פונקציות ראשיות
function addPlanRow(data = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="planType" aria-label="בחר מסלול">
        ${Object.keys(planInfo).map(t => `<option${t===data.type?' selected':''}>${t}</option>`).join('')}
      </select>
    </td>
    <td class="planDesc"></td>
    <td class="planFeat"></td>
    <td class="planRisk"></td>
    <td><input type="number" class="planAmt" aria-label="סכום" min="0" value="${data.amt||0}" placeholder="למשל 800000"></td>
    <td><input type="number" class="planTerm" aria-label="תקופה בשנים" min="1" value="${data.term||20}" placeholder="20"></td>
    <td><input type="number" class="planRate" aria-label="ריבית שנתית" step="0.01" value="${data.rate||3.5}" placeholder="3.5"></td>
    <td class="planPay" aria-live="polite">0</td>
    <td class="planCost" aria-live="polite">0</td>
    <td><button class="btn btn-red remove" aria-label="הסר מסלול">×</button></td>
  `;
  tbody.appendChild(tr);

  // אירועים
  tr.querySelector('.remove').onclick = () => { tr.remove(); recalc(); };
  ['planType','planAmt','planTerm','planRate'].forEach(cls => {
    tr.querySelector('.' + cls).oninput = recalc;
  });
  recalc();
}

function recalc() {
  updateRows();
  calcSummary();
  updateChart();
  savePlans();
}

function updateRows() {
  tbody.querySelectorAll('tr').forEach(tr => {
    const type = tr.querySelector('.planType').value;
    const info = planInfo[type];
    tr.querySelector('.planDesc').textContent = info.desc;
    tr.querySelector('.planFeat').textContent = info.feat;
    tr.querySelector('.planRisk').textContent = info.risk;

    const P = +tr.querySelector('.planAmt').value;
    const yrs = +tr.querySelector('.planTerm').value;
    const r = +tr.querySelector('.planRate').value/100/12;
    const n = yrs*12;
    const M = r>0
      ? (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)
      : P/n;
    const cost = M*n;
    tr.querySelector('.planPay').textContent  = P>0 ? M.toLocaleString('he-IL', {minimumFractionDigits:2}) : '0';
    tr.querySelector('.planCost').textContent = P>0 ? cost.toLocaleString('he-IL', {minimumFractionDigits:2}) : '0';
  });
}

function calcSummary() {
  let totalP=0, totalM=0, totalCost=0;
  tbody.querySelectorAll('tr').forEach(tr => {
    totalP   += +tr.querySelector('.planAmt').value;
    totalM   += +tr.querySelector('.planPay').textContent.replace(/,/g,'');
    totalCost+= +tr.querySelector('.planCost').textContent.replace(/,/g,'');
  });
  summaryEl.innerHTML = `
    <p>סה"כ קרן: <strong>₪${totalP.toLocaleString()}</strong></p>
    <p>סה"כ החזר חודשי: <strong>₪${totalM.toLocaleString()}</strong></p>
    <p>סה"כ עלות: <strong>₪${totalCost.toLocaleString()}</strong></p>
  `;
}

function initChart() {
  amortChart = new Chart(chartCtx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { title: { display: true, text: 'שנים' } },
        y: { title: { display: true, text: 'עלות מצטברת (₪)' } }
      }
    }
  });
}

function updateChart() {
  const datasets = [];
  let maxYears = 0;
  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    const label = tr.querySelector('.planType').value;
    const P = +tr.querySelector('.planAmt').value;
    const yrs = +tr.querySelector('.planTerm').value;
    const r = +tr.querySelector('.planRate').value/100/12;
    const n = yrs*12;
    if (P<=0) return;
    maxYears = Math.max(maxYears, yrs);
    // חשב עלות מצטברת בשנים (נקודות חישוב בכל 12 חודשים)
    const cumCost = Array.from({length: yrs+1}, (_, y) => {
      // צבירת עלות עד y שנים
      const m = y*12;
      let total=0;
      for (let i=1;i<=m;i++) {
        const monthPayment = r>0
          ? (P*r*Math.pow(1+r,i))/(Math.pow(1+r,i)-1)
          : P/n;
        total += monthPayment;
      }
      return total;
    });
    datasets.push({
      label,
      data: cumCost.map(c=>+c.toFixed(2)),
      fill: false,
    });
  });
  amortChart.data.labels = Array.from({length: maxYears+1}, (_,i)=>i);
  amortChart.data.datasets = datasets;
  amortChart.update();
}

// localStorage
function savePlans() {
  const plans = Array.from(tbody.querySelectorAll('tr')).map(tr=>({
    type: tr.querySelector('.planType').value,
    amt: +tr.querySelector('.planAmt').value,
    term:+tr.querySelector('.planTerm').value,
    rate:+tr.querySelector('.planRate').value
  }));
  localStorage.setItem('mortgagePlans', JSON.stringify(plans));
}

function loadPlans() {
  const plans = JSON.parse(localStorage.getItem('mortgagePlans') || '[]');
  if (plans.length) {
    plans.forEach(p=>addPlanRow(p));
  } else {
    addPlanRow();
  }
}
