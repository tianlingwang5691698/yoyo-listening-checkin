const familyFacade = require('../facades/family.facade');

async function bootstrap(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'bootstrap'
  }));
  return familyFacade.buildFamilyContextPayload(ctx);
}

async function setStudyRole(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'setStudyRole'
  }));
  const studyRole = String((((event && event.payload) || {}).studyRole) || '').trim();
  if (studyRole !== 'student' && studyRole !== 'parent') {
    throw new Error('设备身份不可用');
  }
  await familyFacade.setExclusiveStudyRole(ctx.member, studyRole);
  return familyFacade.reloadFamilyContext(ctx.user.openId);
}

async function undoLastListened(event) {
  const { ctx } = await familyFacade.prepareRequestContext(Object.assign({}, event, {
    action: 'undoLastListened'
  }));
  const result = await familyFacade.clearTodayUnconfirmedListens(ctx);
  if (familyFacade.normalizeStudyRole(ctx.member) === 'student') {
    await familyFacade.setExclusiveStudyRole(ctx.member, 'parent');
  }
  return Object.assign({}, await familyFacade.reloadFamilyContext(ctx.user.openId), result);
}

module.exports = {
  bootstrap,
  setStudyRole,
  undoLastListened
};
