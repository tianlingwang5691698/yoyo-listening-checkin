const shared = require('./shared.service');

async function bootstrap(event) {
  const { ctx } = await shared.prepareRequestContext(Object.assign({}, event, {
    action: 'bootstrap'
  }));
  return ctx;
}

async function setStudyRole(event) {
  const { ctx } = await shared.prepareRequestContext(Object.assign({}, event, {
    action: 'setStudyRole'
  }));
  const studyRole = String((((event && event.payload) || {}).studyRole) || '').trim();
  if (studyRole !== 'student' && studyRole !== 'parent') {
    throw new Error('设备身份不可用');
  }
  await shared.setExclusiveStudyRole(ctx.member, studyRole);
  return shared.ensureBootstrap(ctx.user.openId);
}

async function undoLastListened(event) {
  const { ctx } = await shared.prepareRequestContext(Object.assign({}, event, {
    action: 'undoLastListened'
  }));
  const result = await shared.clearTodayUnconfirmedListens(ctx);
  if (shared.normalizeStudyRole(ctx.member) === 'student') {
    await shared.setExclusiveStudyRole(ctx.member, 'parent');
  }
  const nextCtx = await shared.ensureBootstrap(ctx.user.openId);
  return Object.assign({
    user: nextCtx.user,
    currentUser: nextCtx.user,
    family: nextCtx.family,
    currentMember: nextCtx.member,
    members: nextCtx.members,
    child: nextCtx.child,
    subscriptionPreference: nextCtx.subscriptionPreference
  }, result);
}

module.exports = {
  bootstrap,
  setStudyRole,
  undoLastListened
};
