const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const resumes = await p.candidateResume.findMany({ select: { id: true, candidateName: true, requestId: true, documentType: true } });
  console.log('Resumes count:', resumes.length);
  for (const r of resumes) {
    console.log(`  id=${r.id} name=${r.candidateName} req=${r.requestId} type=${r.documentType}`);
  }
  const schedules = await p.interviewSchedule.findMany({ select: { id: true, candidateId: true, requestId: true } });
  console.log('Schedules count:', schedules.length);
  for (const s of schedules) {
    console.log(`  id=${s.id} candidateId=${s.candidateId} req=${s.requestId}`);
  }
  const feedbacks = await p.interviewFeedback.findMany({ select: { id: true, candidateId: true, requestId: true } });
  console.log('Feedbacks count:', feedbacks.length);
  for (const f of feedbacks) {
    console.log(`  id=${f.id} candidateId=${f.candidateId} req=${f.requestId}`);
  }
  await p.$disconnect();
})();