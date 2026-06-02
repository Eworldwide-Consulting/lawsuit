const router = require('express').Router();
const { all, one } = require('../db');
const { requireAuth } = require('../middleware/auth');

const today  = () => new Date().toISOString().slice(0,10);
const nowISO = () => new Date().toISOString().slice(0,19);
const daysLeft = d => Math.round((new Date(d)-new Date())/86400000);

router.get('/client', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const matter = await one(`SELECT m.*, CONCAT(a.first_name,' ',a.last_name) AS attorney_name, a.email AS attorney_email FROM matters m LEFT JOIN users a ON m.attorney_id=a.id WHERE m.client_id=? ORDER BY m.updated_at DESC LIMIT 1`, [uid]);
    const matterIds = (await all('SELECT id FROM matters WHERE client_id=?', [uid])).map(r=>r.id);

    if (!matterIds.length) return res.json({ matter, openTasks:0, overdueTasks:0, tasks:[], upcomingAppts:[], requiredDocsPending:0, uploadedDocs:[], messages:[], deadlines:[], readinessScore:100, totalDocs:0, completedDocs:0, totalTasks:0, completedTasks:0 });

    const inQ = matterIds.map(()=>'?').join(',');
    const t=today(), n=nowISO();

    const [openR,overdueR,totalR,completedR,tasks,appts,allDocs,msgs,deadlineRows] = await Promise.all([
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inQ}) AND status!='completed'`, matterIds),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inQ}) AND status!='completed' AND due_date<?`, [...matterIds,t]),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inQ})`, matterIds),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inQ}) AND status='completed'`, matterIds),
      all(`SELECT * FROM tasks WHERE matter_id IN (${inQ}) AND status!='completed' ORDER BY due_date ASC LIMIT 6`, matterIds),
      all(`SELECT * FROM appointments WHERE matter_id IN (${inQ}) AND start_time>=? ORDER BY start_time ASC LIMIT 3`, [...matterIds,n]),
      all(`SELECT category,status,required FROM documents WHERE matter_id IN (${inQ})`, matterIds),
      all(`SELECT m.*,CONCAT(u.first_name,' ',u.last_name) AS from_name,u.avatar_initials AS from_initials FROM messages m LEFT JOIN users u ON m.from_user_id=u.id WHERE m.to_user_id=? ORDER BY m.created_at DESC LIMIT 5`,[uid]),
      all(`SELECT title,description,due_date FROM tasks WHERE matter_id IN (${inQ}) AND status!='completed' AND due_date>? ORDER BY due_date ASC LIMIT 4`,[...matterIds,t]),
    ]);

    const req_=allDocs.filter(d=>d.required), totalDocs=req_.length, completedDocs=req_.filter(d=>d.status==='uploaded').length;
    const catMap={};
    for(const d of allDocs){const k=d.category||'Uncategorized';if(!catMap[k])catMap[k]={category:k,uploaded:0,total:0};catMap[k].total++;if(d.status==='uploaded')catMap[k].uploaded++;}
    const uploadedDocs=Object.values(catMap).sort((a,b)=>a.category.localeCompare(b.category));

    const deadlines=[];
    if(matter?.important_date){const dl=daysLeft(matter.important_date);if(dl>=0)deadlines.push({title:`Court Hearing – ${matter.description}`,description:`${matter.court} · ${matter.county}`,date:matter.important_date,days_left:dl,urgent:dl<=14});}
    for(const td of deadlineRows){const dl=daysLeft(td.due_date);deadlines.push({...td,date:td.due_date,days_left:dl,urgent:dl<=7});}
    deadlines.sort((a,b)=>a.days_left-b.days_left);

    const openTasks=openR.c,overdueTasks=overdueR.c,totalTasks=totalR.c,completedTasks=completedR.c;
    const docScore=totalDocs>0?(completedDocs/totalDocs)*60:60,taskScore=totalTasks>0?(completedTasks/totalTasks)*30:30,overdueScore=totalTasks>0?Math.max(0,(1-overdueTasks/totalTasks))*10:10;
    res.json({matter,openTasks,overdueTasks,tasks,upcomingAppts:appts,requiredDocsPending:totalDocs-completedDocs,uploadedDocs,messages:msgs,deadlines,readinessScore:Math.round(docScore+taskScore+overdueScore),totalDocs,completedDocs,totalTasks,completedTasks});
  } catch(err){console.error('Client dashboard:',err.message);res.status(500).json({error:err.message});}
});

router.get('/attorney', requireAuth, async (req, res) => {
  try {
    const t=today(),n=nowISO();
    const [totalR,activeR,atRiskR,matters,appts,missingR,overdueR,msgs] = await Promise.all([
      one('SELECT COUNT(*) c FROM matters'),
      one("SELECT COUNT(*) c FROM matters WHERE status='active'"),
      one("SELECT COUNT(*) c FROM matters WHERE status='at_risk'"),
      all(`SELECT m.*,CONCAT(c.first_name,' ',c.last_name) AS client_name,c.avatar_initials AS client_initials,CONCAT(a.first_name,' ',a.last_name) AS attorney_name FROM matters m LEFT JOIN users c ON m.client_id=c.id LEFT JOIN users a ON m.attorney_id=a.id ORDER BY m.updated_at DESC LIMIT 10`),
      all(`SELECT a.*,m.description AS matter_description,m.case_number FROM appointments a LEFT JOIN matters m ON a.matter_id=m.id WHERE a.start_time>=? ORDER BY a.start_time ASC LIMIT 5`,[n]),
      one("SELECT COUNT(*) c FROM documents WHERE status='pending' AND required=1"),
      one(`SELECT COUNT(*) c FROM tasks WHERE status!='completed' AND due_date<?`,[t]),
      all(`SELECT m.*,CONCAT(u.first_name,' ',u.last_name) AS from_name,u.avatar_initials AS from_initials FROM messages m LEFT JOIN users u ON m.from_user_id=u.id WHERE m.to_user_id=? ORDER BY m.created_at DESC LIMIT 5`,[req.user.id]),
    ]);
    const totalMatters=totalR.c,activeMatters=activeR.c,atRiskMatters=atRiskR.c,missingDocs=missingR.c,overdueTasks=overdueR.c;
    const base=12000,months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],cur=new Date().getMonth();
    const revenueData=months.map((month,i)=>{if(i>cur)return{month,revenue:0,collected:0};const revenue=Math.round((totalMatters*base+i*1800)/1000);return{month,revenue,collected:Math.round(revenue*(0.78+(i%4)*0.03))};});
    const ytdRevenue=revenueData.reduce((s,d)=>s+d.revenue*1000,0);
    res.json({totalMatters,activeMatters,atRiskMatters,matters,upcomingAppts:appts,missingDocs,overdueTasks,recentMessages:msgs,ytdRevenue,collectedMonth:revenueData[cur].collected*1000,outstandingAR:Math.round(ytdRevenue*0.17),profitability:Math.max(20,35-atRiskMatters*3),partnerDraws:Math.round(ytdRevenue*0.05),revenueData,healthScore:Math.min(95,Math.max(40,80-atRiskMatters*5-Math.min(15,missingDocs)))});
  } catch(err){console.error('Attorney dashboard:',err.message);res.status(500).json({error:err.message});}
});

router.get('/partner', requireAuth, async (req, res) => {
  try {
    const t=today(),n=nowISO(),future40=new Date(Date.now()+40*86400000).toISOString().slice(0,10);
    const [activeR,missingR,reviewR,deadlineR,matters,appts,clientTasks,allReqDocs,totalR,completedR,overdueR] = await Promise.all([
      one("SELECT COUNT(*) c FROM matters WHERE status!='complete'"),
      one("SELECT COUNT(*) c FROM documents WHERE status='pending' AND required=1"),
      one("SELECT COUNT(*) c FROM matters WHERE stage='court_review'"),
      one('SELECT COUNT(*) c FROM matters WHERE important_date IS NOT NULL AND important_date>=? AND important_date<=?',[t,future40]),
      all(`SELECT m.*,CONCAT(c.first_name,' ',c.last_name) AS client_name,c.avatar_initials AS client_initials,CONCAT(a.first_name,' ',a.last_name) AS attorney_name FROM matters m LEFT JOIN users c ON m.client_id=c.id LEFT JOIN users a ON m.attorney_id=a.id ORDER BY m.updated_at DESC LIMIT 10`),
      all(`SELECT a.*,m.description AS matter_description,m.case_number FROM appointments a LEFT JOIN matters m ON a.matter_id=m.id WHERE a.start_time>=? ORDER BY a.start_time ASC LIMIT 6`,[n]),
      all(`SELECT tk.*,m.description AS matter_description,CONCAT(u.first_name,' ',u.last_name) AS client_name FROM tasks tk LEFT JOIN matters m ON tk.matter_id=m.id LEFT JOIN users u ON tk.assigned_to=u.id WHERE tk.status!='completed' ORDER BY tk.due_date ASC LIMIT 20`),
      all("SELECT category,status FROM documents WHERE required=1"),
      one('SELECT COUNT(*) c FROM tasks'),
      one("SELECT COUNT(*) c FROM tasks WHERE status='completed'"),
      one(`SELECT COUNT(*) c FROM tasks WHERE status!='completed' AND due_date<?`,[t]),
    ]);
    const catMap={};
    for(const d of allReqDocs){const k=d.category||'Uncategorized';if(!catMap[k])catMap[k]={category:k,uploaded:0,total:0};catMap[k].total++;if(d.status==='uploaded')catMap[k].uploaded++;}
    const docStats=Object.values(catMap).sort((a,b)=>a.category.localeCompare(b.category));
    const totalRequired=allReqDocs.length,totalUploaded=allReqDocs.filter(d=>d.status==='uploaded').length;
    const totalTasks=totalR.c,completedTasks=completedR.c,overdueTasks=overdueR.c;
    const docScore=totalRequired>0?(totalUploaded/totalRequired)*60:60,taskScore=totalTasks>0?(completedTasks/totalTasks)*30:30,overdueScore=totalTasks>0?Math.max(0,(1-overdueTasks/totalTasks))*10:10;
    const tasks_ct=clientTasks.map(t=>({...t,days_left:t.due_date?daysLeft(t.due_date):null}));
    const LIFECYCLE=['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    const stageCounts={};for(const m of matters.filter(m=>m.status!=='complete'))stageCounts[m.stage]=(stageCounts[m.stage]||0)+1;
    const topStage=Object.entries(stageCounts).sort(([,a],[,b])=>b-a)[0]?.[0];
    res.json({activeMatters:activeR.c,missingDocs:missingR.c,readyForReview:reviewR.c,annualDeadlines:deadlineR.c,matters,upcomingAppts:appts,clientTasks:tasks_ct,docStats,annualReturnProgress:totalRequired>0?Math.round((totalUploaded/totalRequired)*100):0,readinessScore:Math.round(docScore+taskScore+overdueScore),lifecycleStageIdx:topStage?Math.max(0,LIFECYCLE.indexOf(topStage)):0,totalRequired,totalUploaded,totalTasks,completedTasks,overdueTasks});
  } catch(err){console.error('Partner dashboard:',err.message);res.status(500).json({error:err.message});}
});

module.exports = router;
