const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const engine = fs.readFileSync(path.join(__dirname, 'planning-engine.js'), 'utf8');
const firestore = fs.readFileSync(path.join(__dirname, '..', '..', 'auth', 'firestore.js'), 'utf8');
const planningServices = fs.readFileSync(path.join(__dirname, 'planning-services.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'app.js'), 'utf8');
const features = fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'features.js'), 'utf8');
const auth = fs.readFileSync(path.join(__dirname, '..', '..', 'auth', 'auth.js'), 'utf8');
const login = fs.readFileSync(path.join(__dirname, '..', '..', 'auth', 'login.js'), 'utf8');
const loginPage = fs.readFileSync(path.join(__dirname, '..', '..', 'login.html'), 'utf8');
const planningUi = fs.readFileSync(path.join(__dirname, 'planning-ui.js'), 'utf8');
const planning = fs.readFileSync(path.join(__dirname, 'planning.js'), 'utf8');

function createPlanningEngineContext() {
  const engineContext = { console, Date, URLSearchParams, setTimeout, clearTimeout, window: { PLANNING_USE_MOCKS: false } };
  vm.createContext(engineContext);
  vm.runInContext(engine, engineContext);
  return engineContext;
}

function createPlanningUiContext() {
  const uiContext = createPlanningEngineContext();
  uiContext.refreshCount = 0;
  uiContext.refreshPlanningBoard = () => { uiContext.refreshCount += 1; };
  vm.runInContext(planningUi, uiContext);
  return uiContext;
}

function createPlanningTimelineServiceContext() {
  const serviceContext = createPlanningEngineContext();
  const start = planningServices.indexOf('function formatPlanningCommentDate');
  const end = planningServices.indexOf('function comparePlanningTimelineEventsByDate');
  vm.runInContext(planningServices.slice(start, end), serviceContext);
  return serviceContext;
}

function createFirestorePlanningDateContext() {
  const start = firestore.indexOf('function isPlanningIsoCalendarDate');
  const end = firestore.indexOf('export async function claimPlanningTask');
  const helperSource = firestore
    .slice(start, end)
    .replaceAll('export function ', 'function ');
  const helperContext = { console, Date, Intl };
  vm.createContext(helperContext);
  vm.runInContext(helperSource, helperContext);
  return helperContext;
}

const context = createPlanningEngineContext();

test('pool includes only compatible pending unassigned tasks', () => {
  const available = { id: 'a', estado: 'Pendiente', responsableId: '', disponibleParaAutoasignacion: true };
  const legacy = { id: 'b', estado: 'Pendiente' };
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment(available), true);
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment(legacy), true);
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment({ ...available, responsibleUid: 'u1' }), false);
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment({ ...available, estado: 'Terminado' }), false);
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment({ ...available, deleted: true }), false);
  assert.equal(context.isPlanningTaskAvailableForSelfAssignment({ ...available, disponibleParaAutoasignacion: false }), false);
});

test('responsible filter supports Sin responsable without changing existing filters', () => {
  const tasks = [{ id: 'a', estado: 'Pendiente' }, { id: 'b', estado: 'Pendiente', responsibleName: 'Ana' }];
  const filters = { responsable: '__unassigned__', estado: '', prioridad: '', complejidad: '', search: '' };
  assert.deepEqual(context.filterPlanningTasks(tasks, filters).map(task => task.id), ['a']);
});

test('claim operation is a transaction with server timestamps and audit event', () => {
  assert.match(firestore, /runTransaction\(db, async transaction/);
  assert.match(firestore, /transaction\.get\(taskRef\)/);
  assert.match(firestore, /assignmentMode: "self"/);
  assert.match(firestore, /assignedAt: serverTimestamp\(\)/);
  assert.match(firestore, /action: "self_assigned"/);
  assert.match(firestore, /task\.estado \|\| "Pendiente"/);
  assert.match(firestore, /fechaInicioPlanificada: planningStartDate\.value/);
  assert.match(firestore, /planningStartDateSetAutomatically: planningStartDate\.setAutomatically/);
});

test('automatic planning start date uses the Chile calendar and preserves every non-empty historical value', () => {
  const dateContext = createFirestorePlanningDateContext();
  const beforeChileMidnight = new Date('2026-07-14T02:30:00.000Z');
  const ChileToday = dateContext.getPlanningTodayIsoDate('America/Santiago', beforeChileMidnight);

  assert.equal(ChileToday, '2026-07-13');
  assert.match(ChileToday, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dateContext.resolvePlanningStartDate(undefined, beforeChileMidnight).value, '2026-07-13');
  assert.equal(dateContext.resolvePlanningStartDate(null, beforeChileMidnight).value, '2026-07-13');
  assert.equal(dateContext.resolvePlanningStartDate('', beforeChileMidnight).value, '2026-07-13');
  assert.equal(dateContext.resolvePlanningStartDate('   ', beforeChileMidnight).value, '2026-07-13');
  const preservedDate = dateContext.resolvePlanningStartDate('2026-07-01', beforeChileMidnight);
  assert.equal(preservedDate.value, '2026-07-01');
  assert.equal(preservedDate.previousValue, '2026-07-01');
  assert.equal(preservedDate.setAutomatically, false);
  assert.equal(dateContext.resolvePlanningStartDate('fecha histórica', beforeChileMidnight).value, 'fecha histórica');
});

test('Planning module graph uses one cache version and named Firestore exports exist', () => {
  const version = '2026-07-13-planning-final-ui-audit-v1';
  const requiredExports = ['createTask', 'updateTask', 'getAllTasks', 'getAssignableUsers', 'addComment', 'getComments', 'addTimelineEvent', 'getTimeline', 'claimPlanningTask'];
  const planningImports = ['addComment', 'addTimelineEvent', 'createTask', 'getComments', 'getAllTasks', 'getAssignableUsers', 'getTimeline', 'updateTask'];

  for (const name of requiredExports) {
    assert.match(firestore, new RegExp(`export async function ${name}\\b`));
  }
  for (const name of planningImports) {
    assert.match(planningServices, new RegExp(`\\b${name}\\b`));
  }
  assert.match(planningServices, /claimPlanningTask as claimPlanningTaskInFirestore/);

  assert.match(planningServices, new RegExp(`auth/firestore\\.js\\?v=${version}`));
  assert.match(firestore, new RegExp(`firebase-config\\.js\\?v=${version}`));
  assert.match(auth, new RegExp(`firebase-config\\.js\\?v=${version}`));
  assert.match(auth, new RegExp(`firestore\\.js\\?v=${version}`));
  assert.match(login, new RegExp(`firebase-config\\.js\\?v=${version}`));
  assert.match(login, new RegExp(`firestore\\.js\\?v=${version}`));
  assert.match(index, new RegExp(`window\\.APP_VERSION = "${version}"`));
  assert.match(index, new RegExp(`planning-services\\.js\\?v=${version}`));
  assert.match(app, new RegExp(`features\\.js\\?v=${version}`));
  assert.match(features, /export const FEATURES/);
  assert.match(loginPage, new RegExp(`window\\.APP_VERSION = "${version}"`));
  assert.match(loginPage, new RegExp(`auth\\/login\\.js\\?v=${version}`));
  for (const source of [index, app, auth, login, loginPage, firestore, planningServices]) {
    assert.doesNotMatch(source, /2026-07-13-planning-unassigned-pool-v1/);
  }
});

test('production mode does not initialize the six Planning mocks', () => {
  assert.equal(context.getPlanningTasks().length, 0);
  assert.match(engine, /window\.PLANNING_USE_MOCKS === true/);
});

test('Firestore load errors remain visible without mock replacement and empty data remains empty', () => {
  const failure = context.setPlanningDataError({ code: 'permission-denied', message: 'Missing permissions.' });
  assert.equal(failure.code, 'permission-denied');
  assert.equal(failure.message, 'Missing permissions.');
  assert.equal(context.getPlanningTasks().length, 0);
  assert.match(planningUi, /No se pudieron cargar las tareas reales de Planning/);
  assert.match(planningUi, /retryPlanningDataLoad\(\)/);
  context.setPlanningDataError(null);
  assert.equal(context.getPlanningDataError(), null);
});

test('create and self-assignment pathways preserve the unassigned and concurrency contracts', () => {
  assert.match(planningUi, /const canClaim = canCurrentUserClaimPlanningTask\(\) && isPlanningTaskAvailableForSelfAssignment\(task\)/);
  assert.match(planningUi, /disponibleParaAutoasignacion: !hasResponsible/);
  assert.match(planning, /preparePlanningTaskForSave\(task\)/);
  assert.match(planning, /\["admin", "operator"\]\.includes\(currentUserRole\)/);
  assert.match(firestore, /\["admin", "operator"\]\.includes\(currentUserRole\)/);
  assert.match(firestore, /task\.disponibleParaAutoasignacion === false/);
  assert.match(firestore, /error\.code = "planning\/task-already-claimed"/);
  assert.match(firestore, /transaction\.update\(taskRef, update\)/);
  assert.match(firestore, /transaction\.set\(timelineRef/);
  assert.match(firestore, /nextStatus: task\.estado \|\| "Pendiente"/);
  const claimSource = firestore.slice(
    firestore.indexOf('export async function claimPlanningTask'),
    firestore.indexOf('export async function finishPlanningTask')
  );
  assert.equal((claimSource.match(/runTransaction\(db, async transaction/g) || []).length, 1);
  assert.equal((claimSource.match(/action: "self_assigned"/g) || []).length, 1);
  assert.doesNotMatch(claimSource, /writeBatch\(/);
});

test('local self-assignment removes the task from the pool and keeps it pending under its new responsible', () => {
  const localContext = createPlanningEngineContext();
  localContext.setPlanningTasks([
    {
      id: 'claimable-task',
      planningCode: 'PP-2026-29-001',
      estado: 'Pendiente',
      responsableId: '',
      responsableNombre: '',
      disponibleParaAutoasignacion: true,
      deleted: false
    }
  ]);

  const user = { id: 'user-1', name: 'Operador PSI', email: 'operator@alte.cl' };
  const claimed = localContext.applyPlanningSelfAssignment('claimable-task', user, {
    fechaInicioPlanificada: '2026-07-13'
  });
  const tasks = localContext.getPlanningTasks();
  const grouped = localContext.groupPlanningTasksByUser(tasks);

  assert.equal(claimed.responsableId, user.id);
  assert.equal(claimed.responsableNombre, user.name);
  assert.equal(claimed.assignmentMode, 'self');
  assert.equal(claimed.disponibleParaAutoasignacion, false);
  assert.equal(claimed.estado, 'Pendiente');
  assert.equal(claimed.fechaInicioPlanificada, '2026-07-13');
  assert.equal(claimed.fechaObjetivo, undefined);
  assert.equal(claimed.inicioReal, undefined);
  assert.equal(claimed.operatorPlanningDatesEdited, undefined);
  assert.equal(localContext.getPlanningUnassignedTasks(tasks).length, 0);
  assert.equal(grouped[user.name].length, 1);
  assert.equal(grouped[user.name][0].id, 'claimable-task');
  assert.equal(claimed.timelineLocal.filter(event => event.type === 'self_assigned').length, 1);
  assert.equal(localContext.calculatePlanningKPIs(tasks).pendientes, 1);
});

test('claim applies the persisted planning start date locally and keeps the one-time dates modal available', () => {
  const localContext = createPlanningEngineContext();
  const uiContext = createPlanningUiContext();
  const user = { id: 'operator-1', name: 'Operador PSI', email: 'operator@alte.cl', role: 'operator', active: true, assignable: true };
  const task = {
    id: 'claimed-with-date',
    estado: 'Pendiente',
    responsableId: '',
    disponibleParaAutoasignacion: true,
    fechaInicioPlanificada: '',
    fechaObjetivo: '',
    deleted: false,
    operatorPlanningDatesEdited: false,
    timelineLocal: []
  };

  localContext.setPlanningTasks([task]);
  const claimed = localContext.applyPlanningSelfAssignment(task.id, user, { fechaInicioPlanificada: '2026-07-13' });

  assert.equal(claimed.fechaInicioPlanificada, '2026-07-13');
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(claimed, user), true);
  assert.match(uiContext.renderPlanningWeeklyTask(claimed), /Inicio planificado: 13\/07\/2026/);
  assert.match(planning, /applyPlanningSelfAssignment\(taskId, currentUser, claimedTask\)/);
  assert.match(planningUi, /form\.elements\.fechaInicioPlanificada\.value = toDateInputValue\(task\.fechaInicioPlanificada\)/);
});

test('claim eligibility blocks viewer, inactive, and non-assignable users before a transaction', () => {
  assert.match(planningUi, /getPlanningUserUid\(user\) && user\.active === true && user\.assignable === true && \["admin", "operator"\]\.includes\(role\)/);
  assert.match(firestore, /!currentUserId \|\| currentUser\.active !== true \|\| currentUser\.assignable !== true \|\| !\["admin", "operator"\]\.includes\(currentUserRole\)/);
  assert.match(firestore, /error\.code = "planning\/claim-not-allowed"/);
});

test('pool card actions preserve the admin-only edit and delete permission matrix', () => {
  assert.match(planningUi, /const canManage = canCurrentUserModifyPlanningTasks\(\)/);
  assert.match(planningUi, /editPlanningTask\('\$\{escapePlanningAttribute\(task\.id\)\}', event\)/);
  assert.match(planningUi, /handlePlanningDeleteTask\('\$\{escapePlanningAttribute\(task\.id\)\}', event\)/);
  assert.match(planningUi, /canClaim = canCurrentUserClaimPlanningTask\(\) && isPlanningTaskAvailableForSelfAssignment\(task\)/);
  assert.match(planningUi, /function canCurrentUserModifyPlanningTasks\(\) \{\s*return window\.currentUserProfile\?\.role === "admin";/);
  assert.match(planning, /if \(!canCurrentUserModifyPlanningTasks\(\)\) \{\s*console\.warn\("Acción no permitida"\);\s*return;/);
});

test('editing keeps the only pool rule consistent for unassigned pending tasks', () => {
  const localContext = createPlanningEngineContext();
  localContext.setPlanningTasks([{
    id: 'pool-edit-task',
    planningCode: 'PP-2026-29-002',
    estado: 'Pendiente',
    responsableId: '',
    responsableNombre: '',
    responsableTaller: '',
    disponibleParaAutoasignacion: true,
    deleted: false,
    timelineLocal: []
  }]);

  let updated = localContext.updatePlanningTask('pool-edit-task', { comentario: 'Cambio de comentario' }, 'Admin PSI');
  assert.equal(updated.planningCode, 'PP-2026-29-002');
  assert.equal(localContext.isPlanningTaskAvailableForSelfAssignment(updated), true);
  assert.equal(updated.timelineLocal.filter(event => event.type === 'edit').length, 1);

  updated = localContext.updatePlanningTask('pool-edit-task', { responsableId: 'u-2', responsableNombre: 'Responsable PSI', responsableTaller: 'Responsable PSI', disponibleParaAutoasignacion: false }, 'Admin PSI');
  assert.equal(localContext.isPlanningTaskAvailableForSelfAssignment(updated), false);
  assert.match(updated.timelineLocal.at(-1).description, /Responsable: Sin responsable/);

  updated = localContext.updatePlanningTask('pool-edit-task', { responsableId: '', responsableNombre: '', responsableTaller: '', disponibleParaAutoasignacion: true, estado: 'En proceso' }, 'Admin PSI');
  assert.equal(localContext.isPlanningTaskAvailableForSelfAssignment(updated), false);
  assert.match(updated.timelineLocal.at(-1).description, /Estado: Pendiente/);

  updated = localContext.updatePlanningTask('pool-edit-task', { estado: 'Pendiente' }, 'Admin PSI');
  assert.equal(localContext.isPlanningTaskAvailableForSelfAssignment(updated), true);
  assert.equal(updated.timelineLocal.filter(event => event.type === 'edit').length, 4);
});

test('logical deletion keeps the document update path and excludes the task from the pool', () => {
  const localContext = createPlanningEngineContext();
  localContext.setPlanningTasks([{ id: 'delete-task', estado: 'Pendiente', disponibleParaAutoasignacion: true, deleted: false }]);
  const deletedTask = localContext.updatePlanningTask('delete-task', { deleted: true, deletedBy: 'admin-1', deletedAt: '2026-07-13T00:00:00.000Z' }, 'Admin PSI');
  assert.equal(deletedTask.deleted, true);
  assert.equal(localContext.isPlanningTaskAvailableForSelfAssignment(deletedTask), false);
  assert.match(planning, /deleted: true/);
  assert.match(planning, /deletedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(planning, /deletedBy: getPlanningUserUid\(currentUser\)/);
  assert.doesNotMatch(planning, /deleteTask\(/);
});

test('unassigned pool starts collapsed, toggles in memory, and keeps its current state after task updates', () => {
  const uiContext = createPlanningUiContext();
  const task = { id: 'pool-task', estado: 'Pendiente', disponibleParaAutoasignacion: true, deleted: false };

  assert.equal(uiContext.isPlanningUnassignedPoolExpanded(), false);
  let markup = uiContext.renderPlanningUnassignedTaskPool([task]);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /id="planningUnassignedPoolContent" hidden/);
  assert.match(markup, /1 tareas disponibles/);

  uiContext.togglePlanningUnassignedPool();
  assert.equal(uiContext.isPlanningUnassignedPoolExpanded(), true);
  assert.equal(uiContext.refreshCount, 1);
  markup = uiContext.renderPlanningUnassignedTaskPool([task]);
  assert.match(markup, /aria-expanded="true"/);
  assert.doesNotMatch(markup, /planningUnassignedPoolContent" hidden/);
  assert.match(markup, /planning-pool-task/);

  uiContext.togglePlanningUnassignedPool();
  assert.equal(uiContext.isPlanningUnassignedPoolExpanded(), false);
  assert.equal(uiContext.refreshCount, 2);
});

test('Sin responsable filter expands the pool and the empty state remains available behind the accessible header', () => {
  const uiContext = createPlanningUiContext();
  uiContext.updatePlanningFilter('responsable', '__unassigned__');
  assert.equal(uiContext.isPlanningUnassignedPoolExpanded(), true);
  assert.equal(uiContext.refreshCount, 1);

  let markup = uiContext.renderPlanningUnassignedTaskPool([]);
  assert.match(markup, /aria-controls="planningUnassignedPoolContent"/);
  assert.match(markup, /0 tareas disponibles/);
  assert.match(markup, /No hay tareas disponibles para autoasignación/);

  uiContext.setPlanningUnassignedPoolExpanded(false);
  markup = uiContext.renderPlanningUnassignedTaskPool([]);
  assert.match(markup, /planningUnassignedPoolContent" hidden/);
});

test('operator can define dates once only for their own pending assigned task', () => {
  const localContext = createPlanningEngineContext();
  const operator = { id: 'operator-1', role: 'operator', active: true, assignable: true, name: 'Operador PSI' };
  const task = {
    id: 'operator-date-task',
    planningCode: 'PP-2026-29-003',
    estado: 'Pendiente',
    responsableId: 'operator-1',
    responsableNombre: 'Operador PSI',
    fechaInicioPlanificada: '',
    fechaObjetivo: '',
    deleted: false,
    operatorPlanningDatesEdited: false,
    timelineLocal: []
  };

  localContext.setPlanningTasks([task]);
  assert.equal(localContext.getPlanningUserUid({ uid: 'uid-first', id: 'id-second', userId: 'user-third' }), 'uid-first');
  assert.equal(localContext.getPlanningUserUid({ id: 'id-only' }), 'id-only');
  assert.equal(localContext.getPlanningUserUid({ userId: 'user-id-only' }), 'user-id-only');
  assert.equal(localContext.getPlanningUserUid({ name: 'Operador PSI', email: 'operator@alte.cl' }), '');
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, operator), true);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, { ...operator, id: 'operator-2' }), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, estado: 'En proceso' }, operator), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, operatorPlanningDatesEdited: true }, operator), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, { ...operator, role: 'viewer' }), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, responsableId: undefined, responsibleUid: 'operator-1' }, operator), true);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, responsableId: undefined, responsibleUid: undefined, assignedBy: 'operator-1' }, operator), true);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, responsableId: 101 }, { ...operator, id: undefined, uid: '101', role: ' Operator ' }), true);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates({ ...task, responsableId: 'X6tnIHLnlJcQippi7jYPawDvNcu1' }, {
    id: 'X6tnIHLnlJcQippi7jYPawDvNcu1', role: 'operator', active: true, assignable: true
  }), true);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, { ...operator, uid: 'other-operator', id: undefined }), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, { ...operator, active: false }), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, { ...operator, assignable: false }), false);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(task, {
    name: 'Operador PSI', email: 'operator@alte.cl', role: 'operator', active: true, assignable: true
  }), false);

  const updated = localContext.applyOperatorPlanningDatesOnce(task.id, {
    fechaInicioPlanificada: '2026-07-13',
    fechaObjetivo: '2026-07-15'
  }, operator);
  assert.equal(updated.fechaInicioPlanificada, '2026-07-13');
  assert.equal(updated.fechaObjetivo, '2026-07-15');
  assert.equal(updated.operatorPlanningDatesEdited, true);
  assert.equal(updated.operatorPlanningDatesEditedBy, operator.id);
  assert.equal(updated.planningCode, task.planningCode);
  assert.equal(updated.timelineLocal.filter(event => event.type === 'operator_planning_dates_set').length, 1);
  assert.equal(localContext.canCurrentOperatorEditPlanningDates(updated, operator), false);

  localContext.setPlanningTasks([{ ...task, id: 'uid-autoassign-task', responsableId: '', responsibleUid: '', assignedBy: '' }]);
  const uidClaimed = localContext.applyPlanningSelfAssignment('uid-autoassign-task', { uid: 'uid-first', id: 'id-second', name: 'Operador UID' });
  assert.equal(uidClaimed.responsableId, 'uid-first');
  assert.equal(uidClaimed.responsibleUid, 'uid-first');
  assert.equal(uidClaimed.assignedBy, 'uid-first');
  assert.equal(uidClaimed.updatedBy, 'uid-first');
});

test('operator planning dates use strict ISO calendar validation and chronological order', () => {
  const localContext = createPlanningEngineContext();
  const validate = localContext.validatePlanningDateRange;

  assert.equal(validate('2026-07-20', '2026-07-23'), '');
  assert.equal(validate('2026-07-20', '2026-07-20'), '');
  assert.equal(validate('2026-12-31', '2027-01-01'), '');
  assert.equal(validate('2026-02-28', '2026-03-01'), '');
  assert.equal(validate('2026-07-23', '2026-07-20'), 'La fecha objetivo no puede ser anterior a la fecha de inicio.');
  assert.match(validate('2026-02-30', '2026-03-01'), /YYYY-MM-DD/);
  assert.match(validate('2026-13-01', '2026-12-31'), /YYYY-MM-DD/);
  assert.match(validate('', '2026-07-23'), /YYYY-MM-DD/);
  assert.match(validate('2026-07-20', ''), /YYYY-MM-DD/);
  assert.match(validate('20/07/2026', '23/07/2026'), /YYYY-MM-DD/);
  assert.equal(validate('2026-07-20', '2026-07-23'), '');
});

test('the real assigned-task card renders operator date action independently from admin actions', () => {
  const uiContext = createPlanningUiContext();
  const david = {
    id: 'X6tnIHLnlJcQippi7jYPawDvNcu1',
    role: 'operator',
    active: true,
    assignable: true
  };
  const task = {
    id: 'task-1',
    planningCode: 'PP-2026-29-001',
    actividad: 'Tarea David',
    responsableId: david.id,
    estado: 'Pendiente',
    deleted: false,
    operatorPlanningDatesEdited: false
  };

  uiContext.window.currentUserProfile = david;
  assert.match(uiContext.renderPlanningCard(task), /Definir fechas/);
  assert.doesNotMatch(uiContext.renderPlanningCard({ ...task, responsableId: 'other-user' }), /Definir fechas/);
  assert.doesNotMatch(uiContext.renderPlanningCard({ ...task, operatorPlanningDatesEdited: true }), /Definir fechas/);
  assert.doesNotMatch(uiContext.renderPlanningCard({ ...task, estado: 'En proceso' }), /Definir fechas/);
  uiContext.window.currentUserProfile = { ...david, role: 'viewer' };
  assert.doesNotMatch(uiContext.renderPlanningCard(task), /Definir fechas/);
  uiContext.window.currentUserProfile = { ...david, role: 'admin' };
  assert.match(uiContext.renderPlanningCard(task), /Editar/);
  assert.doesNotMatch(uiContext.renderPlanningUnassignedTask(task), /Definir fechas/);
});

test('admin can take and finish only an available pool task with one local audit event', () => {
  const localContext = createPlanningEngineContext();
  const admin = { id: 'admin-1', role: ' Admin ', active: true, name: 'Admin PSI', email: 'admin@alte.cl' };
  const task = {
    id: 'admin-finish-task',
    planningCode: 'PP-2026-29-099',
    actividad: 'Apoyo urgente',
    estado: 'Pendiente',
    responsableId: '',
    responsableNombre: '',
    disponibleParaAutoasignacion: true,
    deleted: false,
    fechaInicioPlanificada: '',
    fechaObjetivo: '',
    timelineLocal: []
  };

  assert.equal(localContext.canAdminTakeAndFinishPlanningTask(task, admin), true);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask(task, { ...admin, role: 'operator' }), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask(task, { ...admin, role: 'viewer' }), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask(task, { ...admin, active: false }), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask({ ...task, responsableId: 'operator-1' }, admin), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask({ ...task, estado: 'En proceso' }, admin), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask({ ...task, deleted: true }, admin), false);
  assert.equal(localContext.canAdminTakeAndFinishPlanningTask({ ...task, disponibleParaAutoasignacion: false }, admin), false);

  localContext.setPlanningTasks([task]);
  const completedAt = '2026-07-20T12:34:56.000Z';
  const completed = localContext.applyAdminTakeAndFinishPlanningTask(task.id, admin, completedAt);
  assert.equal(completed.estado, 'Terminado');
  assert.equal(completed.responsableId, admin.id);
  assert.equal(completed.responsibleUid, admin.id);
  assert.equal(completed.assignmentMode, 'admin_take_and_finish');
  assert.equal(completed.disponibleParaAutoasignacion, false);
  assert.equal(completed.inicioReal, completedAt);
  assert.equal(completed.fechaTerminoReal, completedAt);
  assert.equal(completed.terminadoAt, completedAt);
  assert.equal(completed.updatedBy, admin.id);
  assert.equal(completed.fechaInicioPlanificada, '');
  assert.equal(completed.fechaObjetivo, '');
  assert.equal(completed.operatorPlanningDatesEdited, undefined);
  assert.equal(completed.timelineLocal.filter(event => event.type === 'admin_take_and_finish').length, 1);
  assert.equal(completed.timelineLocal.filter(event => ['self_assigned', 'start', 'finish'].includes(event.type)).length, 0);
  assert.equal(localContext.getPlanningUnassignedTasks(localContext.getPlanningTasks()).length, 0);
  assert.equal(localContext.calculatePlanningKPIs(localContext.getPlanningTasks()).terminadas, 1);
});

test('admin take and finish is rendered only for admins in the real pool card and uses one transaction', () => {
  const uiContext = createPlanningUiContext();
  const task = { id: 'pool-admin-finish', planningCode: 'PP-2026-29-100', actividad: 'Tarea bolsa', estado: 'Pendiente', responsableId: '', disponibleParaAutoasignacion: true, deleted: false };
  uiContext.window.currentUserProfile = { id: 'admin-1', role: 'admin', active: true, name: 'Admin PSI' };
  assert.match(uiContext.renderPlanningUnassignedTask(task), /Tomar y terminar/);
  uiContext.window.currentUserProfile = { id: 'operator-1', role: 'operator', active: true };
  assert.doesNotMatch(uiContext.renderPlanningUnassignedTask(task), /Tomar y terminar/);
  uiContext.window.currentUserProfile = { id: 'viewer-1', role: 'viewer', active: true };
  assert.doesNotMatch(uiContext.renderPlanningUnassignedTask(task), /Tomar y terminar/);

  const source = firestore.slice(
    firestore.indexOf('export async function adminTakeAndFinishPlanningTask'),
    firestore.indexOf('export async function saveOperatorPlanningDatesOnce')
  );
  assert.equal((source.match(/runTransaction\(db, async transaction/g) || []).length, 1);
  assert.equal((source.match(/action: "admin_take_and_finish"/g) || []).length, 1);
  assert.match(source, /inicioReal: completedAt/);
  assert.match(source, /fechaTerminoReal: completedAt/);
  assert.match(source, /assignmentMode: "admin_take_and_finish"/);
  assert.match(planning, /¿Tomar y terminar esta tarea ahora\?/);
  assert.match(planning, /applyAdminTakeAndFinishPlanningTask\(taskId, currentUser, completedTask\)/);
  assert.match(planning, /"Duración": getPlanningDurationLabel\(task\)/);
  assert.match(planning, /"Modo asignación": task\.assignmentMode/);
  assert.match(planningUi, /Inicio real: \$\{escapePlanningHtml\(formatPlanningDisplayDate\(task\.inicioReal\)/);
  assert.match(planningUi, /Duración: \$\{escapePlanningHtml\(getPlanningDurationLabel\(task\)\)/);
});

test('completed task status, completion date, ISO week, and local merge share one contract', () => {
  const localContext = createPlanningEngineContext();
  const completedAt = '2026-07-13T12:00:00.000Z';
  const task = {
    planningCode: 'PP-2026-29-001',
    estado: 'Terminado',
    inicioReal: completedAt,
    fechaTerminoReal: completedAt,
    terminadoAt: completedAt,
    assignmentMode: 'admin_take_and_finish',
    responsableNombre: 'Adrián'
  };

  assert.equal(localContext.isPlanningTaskCompleted(task), true);
  assert.equal(localContext.isPlanningTaskCompleted({ ...task, estado: 'Terminada' }), true);
  assert.equal(localContext.getIsoWeekKeyFromPlanningDate(localContext.getPlanningTaskCompletionDate(task)), '2026-W29');
  assert.equal(localContext.getIsoWeekKeyFromPlanningDate({ toDate: () => new Date(completedAt) }), '2026-W29');
  assert.equal(localContext.getPlanningTaskCompletionDate({ ...task, fechaTerminoReal: '', terminadoAt: '', completedAt: '' }), null);
  assert.equal(localContext.getIsoWeekKeyFromPlanningDate('invalid'), '');
  assert.equal(localContext.calculatePlanningKPIs([task]).terminadas, 1);
  assert.match(planningUi, /getPlanningTaskCompletionDate\(task\)/);
  assert.match(planningUi, /getIsoWeekKeyFromPlanningDate/);
  assert.match(planningUi, /Semana \$\{Number\(String\(week\)\.replace\("W", ""\)\)\}/);
  assert.match(planning, /"Estado": isPlanningTaskCompleted\(task\) \? "Terminado"/);
  assert.match(planning, /"Fecha término real": formatPlanningExportDate\(task\.fechaTerminoReal \|\| task\.terminadoAt/);
});

test('operator finish persists one canonical completion contract and timeline transaction', () => {
  const finishSource = firestore.slice(
    firestore.indexOf('export async function finishPlanningTask'),
    firestore.indexOf('export async function executePlanningTaskAction')
  );

  assert.equal((finishSource.match(/runTransaction\(db, async transaction/g) || []).length, 1);
  assert.equal((finishSource.match(/action: "finish"/g) || []).length, 1);
  assert.match(finishSource, /const completedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(finishSource, /const startedAt = task\.inicioReal \|\| completedAt/);
  assert.match(finishSource, /estado: "Terminado"/);
  assert.match(finishSource, /inicioReal: startedAt/);
  assert.match(finishSource, /fechaTerminoReal: completedAt/);
  assert.match(finishSource, /terminadoAt: completedAt/);
  assert.match(finishSource, /terminadoBy: currentUserId/);
  assert.match(finishSource, /updatedAt: serverTimestamp\(\)/);
  assert.match(finishSource, /updatedBy: currentUserId/);
  assert.match(planningServices, /executePlanningTaskAction as executePlanningTaskActionInFirestore/);
  assert.match(planning, /const persistedTask = await executePlanningTaskActionInFirestore\(taskId, action, currentUser\)/);
  assert.match(planning, /applyPersistedPlanningExecutionTask\(taskId, action, persistedTask, currentUser\)/);
});

test('operator finish merges persisted dates locally into the ISO weekly completed summary', () => {
  const localContext = createPlanningUiContext();
  const david = { id: 'david-1', name: 'David Salas', email: 'david@alte.cl', role: 'operator', active: true, assignable: true };
  const startedAt = '2026-07-13T10:00:00.000Z';
  const completedAt = '2026-07-13T10:45:00.000Z';
  const task = {
    id: 'operator-finish-existing-start',
    planningCode: 'PP-2026-29-001',
    actividad: 'Validación operator',
    cliente: 'Cliente PSI',
    responsableNombre: 'David Salas',
    estado: 'En proceso',
    inicioReal: startedAt,
    timelineLocal: []
  };

  localContext.setPlanningTasks([task]);
  const finished = localContext.applyFinishedPlanningTask(task.id, {
    id: task.id,
    estado: 'Terminado',
    inicioReal: startedAt,
    fechaTerminoReal: completedAt,
    terminadoAt: completedAt,
    terminadoBy: david.id,
    updatedAt: completedAt,
    updatedBy: david.id
  }, david);

  assert.equal(finished.estado, 'Terminado');
  assert.equal(finished.inicioReal, startedAt);
  assert.equal(finished.fechaTerminoReal, completedAt);
  assert.equal(finished.terminadoAt, completedAt);
  assert.equal(finished.terminadoBy, david.id);
  assert.equal(localContext.isPlanningTaskCompleted(finished), true);
  assert.equal(localContext.getIsoWeekKeyFromPlanningDate(localContext.getPlanningTaskCompletionDate(finished)), '2026-W29');
  assert.equal(localContext.getPlanningCompletedWeekKey(finished), '2026-W29');
  assert.equal(localContext.getPlanningDurationLabel(finished), '45 min');
  assert.equal(finished.timelineLocal.filter(event => event.type === 'finish').length, 1);
  assert.match(localContext.renderPlanningCompletedTask(finished), /David Salas/);
  assert.match(localContext.renderPlanningCompletedTask(finished), /45 min/);
  assert.match(planning, /"Fecha término real": formatPlanningExportDate\(task\.fechaTerminoReal \|\| task\.terminadoAt/);
});

test('operator direct finish uses one instant for a zero-minute duration without changing planned dates', () => {
  const localContext = createPlanningUiContext();
  const david = { id: 'david-1', name: 'David Salas' };
  const completedAt = '2026-07-13T12:00:00.000Z';
  const task = {
    id: 'operator-finish-direct',
    estado: 'Pendiente',
    fechaInicioPlanificada: '2026-07-13',
    fechaObjetivo: '',
    timelineLocal: []
  };

  localContext.setPlanningTasks([task]);
  const finished = localContext.applyFinishedPlanningTask(task.id, {
    estado: 'Terminado',
    inicioReal: completedAt,
    fechaTerminoReal: completedAt,
    terminadoAt: completedAt,
    terminadoBy: david.id,
    updatedAt: completedAt,
    updatedBy: david.id
  }, david);

  assert.equal(finished.inicioReal, completedAt);
  assert.equal(finished.fechaTerminoReal, completedAt);
  assert.equal(finished.fechaInicioPlanificada, '2026-07-13');
  assert.equal(finished.fechaObjetivo, '');
  assert.equal(localContext.getPlanningDurationLabel(finished), '0 min');
  assert.equal(localContext.getPlanningCompletedWeekKey(finished), '2026-W29');
});

test('operator dates modal and transaction restrict writes to the two dates and consume the opportunity atomically', () => {
  assert.match(planningUi, /Definir fechas planificadas/);
  assert.match(planningUi, /Esta edición solo podrá realizarse una vez/);
  assert.match(planningUi, /fechaInicioPlanificada.*type="date"/);
  assert.match(planningUi, /fechaObjetivo.*type="date"/);
  assert.match(planningUi, /saveOperatorPlanningDatesOnceAction\(taskId, dates\)/);
  assert.match(planningUi, /canCurrentOperatorEditPlanningDates\(task, window\.currentUserProfile\)/);
  assert.match(planning, /canCurrentOperatorEditPlanningDates\(task, currentUser\)/);
  assert.match(planningServices, /saveOperatorPlanningDatesOnceInFirestore\(taskId, dates, currentUser\)/);
  assert.match(planningServices, /getPlanningUserUid/);
  assert.match(planningServices, /validatePlanningDateRangeInFirestore/);
  assert.match(planningServices, /currentUserRole !== "operator"/);
  assert.match(firestore, /export async function saveOperatorPlanningDatesOnce/);
  assert.match(firestore, /export function getPlanningUserUid/);
  assert.match(firestore, /user\?\.uid \|\| user\?\.id \|\| user\?\.userId/);
  assert.match(firestore, /export function getPlanningTaskOwnerUid/);
  assert.match(firestore, /export function validatePlanningDateRange/);
  assert.match(firestore, /Date\.UTC\(year, month - 1, day\)/);
  assert.match(planningUi, /const validationMessage = validatePlanningDateRange/);
  assert.match(planning, /const validationMessage = validatePlanningDateRange/);
  assert.match(firestore, /runTransaction\(db, async transaction/);
  assert.match(firestore, /operatorPlanningDatesEdited: true/);
  assert.match(firestore, /operatorPlanningDatesEditedAt: serverTimestamp\(\)/);
  assert.match(firestore, /operatorPlanningDatesEditedBy: currentUserId/);
  assert.match(firestore, /action: "operator_planning_dates_set"/);
  assert.match(firestore, /planning\/operator-dates-already-used/);
  assert.match(firestore, /taskOwnerId !== currentUserId/);
  assert.match(firestore, /task\.fechaInicioPlanificada === startDate && task\.fechaObjetivo === targetDate/);
  assert.doesNotMatch(engine, /console\.table/);
  assert.doesNotMatch(planningUi, /\[Planning\] can edit dates/);
});

test('new directly-completed tasks are normalized without mutating normal creation tasks', () => {
  const localContext = createPlanningEngineContext();
  const now = new Date('2026-07-14T02:30:00.000Z');
  const admin = { uid: 'uid-1', name: 'Admin', role: 'admin', active: true, assignable: true };
  const pending = { estado: 'Pendiente', fechaObjetivo: '' };
  const completed = { estado: 'Terminada', fechaInicioPlanificada: '', fechaObjetivo: '' };
  const pendingResult = localContext.prepareNewPlanningTaskForCreation(pending, admin, now);
  const result = localContext.prepareNewPlanningTaskForCreation(completed, admin, now);
  assert.equal(pendingResult.inicioReal, undefined);
  assert.equal(result.estado, 'Terminado');
  assert.equal(result.inicioReal, result.fechaTerminoReal);
  assert.equal(result.inicioReal, result.terminadoAt);
  assert.equal(result.terminadoBy, 'uid-1');
  assert.equal(result.updatedBy, 'uid-1');
  assert.equal(result.fechaInicioPlanificada, '2026-07-13');
  assert.equal(result.fechaObjetivo, '');
  assert.equal(result.responsableId, 'uid-1');
  assert.equal(result.assignmentMode, 'created_as_completed');
  assert.equal(completed.inicioReal, undefined);
  assert.equal(localContext.isPlanningTaskCompleted(result), true);
  assert.equal(localContext.getPlanningTaskCompletionDate(result).toISOString(), result.inicioReal);
  assert.equal(localContext.getPlanningUnassignedTasks([result]).length, 0);
  assert.throws(() => localContext.prepareNewPlanningTaskForCreation({ estado: 'Terminado' }, { role: 'viewer', active: true, assignable: true }, now), /responsable válido/);
  assert.equal(localContext.prepareNewPlanningTaskForCreation({ estado: 'Terminado', responsableId: 'selected', responsableNombre: 'Ana' }, { id: 'creator', role: 'viewer' }, now).responsableId, 'selected');
});

test('new timeline events preserve the authenticated actor without a fixed fallback', () => {
  const localContext = createPlanningEngineContext();
  const santiago = { uid: 'santiago-uid', name: 'Santiago Chacón', email: 'santiago@alte.cl' };
  const david = { id: 'david-uid', displayName: 'David Salas', email: 'david@alte.cl' };
  const admin = { userId: 'admin-uid', name: 'Administrador PSI' };

  const santiagoEvent = localContext.createPlanningTimelineEvent('create', 'Tarea creada', '2026-07-13T10:00:00.000Z', santiago, { taskId: 'santiago-task', planningCode: 'PP-2026-29-006' });
  const davidEvent = localContext.createPlanningTimelineEvent('create', 'Tarea creada', '2026-07-13T10:00:00.000Z', david);
  const adminEvent = localContext.createPlanningTimelineEvent('create', 'Tarea creada', '2026-07-13T10:00:00.000Z', admin);

  assert.deepEqual({ user: santiagoEvent.user, userId: santiagoEvent.userId, taskId: santiagoEvent.taskId, planningCode: santiagoEvent.planningCode }, {
    user: 'Santiago Chacón', userId: 'santiago-uid', taskId: 'santiago-task', planningCode: 'PP-2026-29-006'
  });
  assert.equal(davidEvent.user, 'David Salas');
  assert.equal(davidEvent.userId, 'david-uid');
  assert.equal(adminEvent.user, 'Administrador PSI');
  assert.equal(adminEvent.userId, 'admin-uid');
  assert.equal(localContext.getPlanningTimelineActorName({ user: 'Santiago Chacón', userId: 'other' }), 'Santiago Chacón');
  assert.equal(localContext.getPlanningTimelineActorName({}, 'Sistema'), 'Sistema');

  const serviceContext = createPlanningTimelineServiceContext();
  serviceContext.setPlanningResponsibleUsers([{ uid: 'santiago-uid', name: 'Santiago Chacón' }]);
  const normalized = serviceContext.normalizePlanningTimelineEventFromFirestore({
    action: 'create',
    comment: 'Tarea creada',
    user: 'Santiago Chacón',
    userId: 'santiago-uid',
    createdAt: '2026-07-13T10:00:00.000Z'
  });
  assert.equal(normalized.user, 'Santiago Chacón');
  assert.equal(normalized.userId, 'santiago-uid');

  const uiContext = createPlanningUiContext();
  const timelineList = { innerHTML: '' };
  uiContext.document = { getElementById(id) { return id === 'timelineList' ? timelineList : null; } };
  uiContext.renderPlanningTimelineList({ actividad: 'Prueba', timelineLocal: [normalized] });
  assert.match(timelineList.innerHTML, /Santiago Chacón/);

  assert.doesNotMatch(engine, /user:\s*["']Adrián["']/);
  assert.doesNotMatch(planningServices, /user:\s*["']Adrián["']/);
  assert.doesNotMatch(planningUi, /event\.user \|\| "Adrián"/);
  assert.match(planningServices, /user: getPlanningTimelineActorName\(event, "Sistema"\)/);
  assert.match(planningUi, /getPlanningTimelineActorName\(event, "Sistema"\)/);
});

test('weekly counts include Santiago completed tasks by real completion week while active cards stay separate', () => {
  const localContext = createPlanningUiContext();
  const santiagoTasks = [
    { id: '006', planningCode: 'PP-2026-29-006', responsableId: 'santiago-uid', estado: 'Terminado', fechaTerminoReal: '2026-07-15T12:00:00.000Z' },
    { id: '010', planningCode: 'PP-2026-29-010', responsibleUid: 'santiago-uid', estado: 'Terminada', terminadoAt: '2026-07-16T12:00:00.000Z' },
    { id: 'pending', planningCode: 'PP-2026-29-011', responsableNombre: 'Santiago Chacón', estado: 'Pendiente', fechaObjetivo: '2026-07-17' },
    { id: 'other-week', responsableId: 'santiago-uid', estado: 'Terminado', fechaTerminoReal: '2026-07-22T12:00:00.000Z' },
    { id: 'other-user', responsableNombre: 'David Salas', estado: 'Terminado', fechaTerminoReal: '2026-07-16T12:00:00.000Z' }
  ];
  localContext.setPlanningResponsibleUsers([{ uid: 'santiago-uid', name: 'Santiago Chacón' }, { uid: 'david-uid', name: 'David Salas' }]);

  const weekTasks = localContext.getPlanningTasksForIsoWeek(santiagoTasks, '2026-W29');
  const counts = localContext.getPlanningWeeklyStatusCountsForResponsible(santiagoTasks, 'santiago-uid', '2026-W29');
  const completed = santiagoTasks.filter(localContext.isPlanningTaskCompleted);
  const active = weekTasks.filter(task => !localContext.isPlanningTaskCompleted(task));

  assert.equal(counts.terminadas, 2);
  assert.equal(counts.pendientes, 1);
  assert.equal(weekTasks.some(task => task.planningCode === 'PP-2026-29-006'), true);
  assert.equal(weekTasks.some(task => task.id === 'other-week'), false);
  assert.equal(weekTasks.some(task => task.id === 'other-user'), true);
  assert.equal(active.some(task => task.planningCode === 'PP-2026-29-006'), false);
  assert.equal(localContext.getPlanningCompletedWeekKey(completed[0]), '2026-W29');
  assert.match(localContext.renderPlanningWeeklySection(active, 29, completed.filter(task => localContext.getPlanningCompletedWeekKey(task) === '2026-W29')), /Terminadas: <strong>2<\/strong>/);
  assert.match(localContext.renderPlanningCompletedSummary(completed), /PP-2026-29-006/);
});

test('creation and execution use atomic actor-aware planning contracts', () => {
  const createSource = firestore.slice(
    firestore.indexOf('export async function createPlanningTaskWithTimeline'),
    firestore.indexOf('export function getPlanningUserUid')
  );
  const executionSource = firestore.slice(
    firestore.indexOf('export async function executePlanningTaskAction'),
    firestore.indexOf('export async function adminTakeAndFinishPlanningTask')
  );

  assert.match(createSource, /runTransaction\(db, async transaction/);
  assert.match(createSource, /transaction\.set\(taskRef, taskData\)/);
  assert.match(createSource, /transaction\.set\(timelineRef, eventData\)/);
  assert.match(createSource, /action: "create"/);
  assert.match(createSource, /type: "create"/);
  assert.match(createSource, /userId,/);
  assert.match(createSource, /user: userName/);
  assert.match(executionSource, /start: \{ from: "pendiente", to: "En proceso"/);
  assert.match(executionSource, /pause: \{ from: "en proceso", to: "Pausada"/);
  assert.match(executionSource, /resume: \{ from: "pausada", to: "En proceso"/);
  assert.match(executionSource, /const actionInstant = new Date\(\)\.toISOString\(\)/);
  assert.match(executionSource, /update\.inicioReal = task\.inicioReal \|\| actionInstant/);
  assert.match(executionSource, /resolvePlanningStartDate\(task\.fechaInicioPlanificada, new Date\(actionInstant\)\)/);
  assert.match(executionSource, /transaction\.update\(taskRef, update\)/);
  assert.match(executionSource, /transaction\.set\(timelineRef/);
  assert.match(executionSource, /estadoAnterior: task\.estado \|\| ""/);
  assert.match(executionSource, /estadoNuevo: transition\.to/);
  assert.match(planningServices, /executePlanningTaskAction as executePlanningTaskActionInFirestore/);
  assert.match(planning, /executePlanningTaskActionInFirestore\(taskId, action, currentUser\)/);
  assert.match(planning, /applyPersistedPlanningExecutionTask\(taskId, action, persistedTask, currentUser\)/);
});

test('Planning UI hides empty project placeholders and starts weekly groups collapsed', () => {
  const localContext = createPlanningUiContext();
  const task = {
    id: 'compact-completed',
    planningCode: 'PP-2026-29-200',
    actividad: 'Inspección final',
    responsableNombre: 'Santiago Chacón',
    estado: 'Terminado',
    cliente: 'Cliente PSI',
    fechaTerminoReal: '2026-07-15T12:00:00.000Z'
  };

  assert.equal(localContext.isPlanningSectionCollapsed('weekly', 'Santiago Chacón'), true);
  localContext.togglePlanningSection('weekly', 'Santiago Chacón');
  assert.equal(localContext.isPlanningSectionCollapsed('weekly', 'Santiago Chacón'), false);
  assert.doesNotMatch(localContext.renderPlanningWeeklyTask({ ...task, estado: 'Pendiente', fechaObjetivo: '' }), /Sin proyecto|Sin fecha/);
  assert.doesNotMatch(localContext.renderPlanningCard({ ...task, estado: 'Pendiente', proyecto: '' }), /Sin proyecto/);
  assert.match(localContext.renderPlanningCompletedTaskCompact(task), /planning-completed-card/);
  assert.match(localContext.renderPlanningCompletedTaskCompact(task), /planning-completed-date-badge/);
  assert.doesNotMatch(localContext.renderPlanningCompletedTaskCompact(task), /Sin proyecto|Sin fecha/);
  assert.equal(localContext.formatPlanningDisplayDate('2026-07-13T21:46:13.768Z'), '13/07/2026');
  assert.equal(localContext.formatPlanningDisplayDate('2026-07-13'), '13/07/2026');
  assert.doesNotMatch(localContext.renderPlanningCompletedTaskCompact({ ...task, inicioReal: '2026-07-13T21:46:13.768Z', fechaObjetivo: '', fechaTerminoReal: '' }), /T21:46:13\.768Z|Objetivo/);
});

test('completed task creation shows the contextual message and keeps the expected export fields', () => {
  const localContext = createPlanningUiContext();
  const hint = { hidden: true };
  localContext.document = {
    getElementById(id) {
      return id === 'planningCompletedStatusHint' ? hint : null;
    }
  };
  const completedFormData = {
    get(name) {
      return {
        actividadCatalog: 'Pruebas',
        tipo: 'Interna',
        estado: 'Terminado',
        prioridad: 'Normal',
        complejidad: 'Media'
      }[name] || '';
    }
  };

  localContext.handlePlanningCompletedStatusHint('Terminado');
  assert.equal(hint.hidden, false);
  localContext.handlePlanningCompletedStatusHint('Pendiente');
  assert.equal(hint.hidden, true);
  localContext.window.currentUserProfile = { uid: 'viewer-1', role: 'viewer', active: true, assignable: true };
  assert.equal(
    localContext.validatePlanningTaskForm({}, completedFormData, { uid: '', name: '' }, 'Pruebas'),
    'No es posible crear una tarea terminada sin un responsable válido.'
  );
  localContext.window.currentUserProfile = { uid: 'operator-1', role: 'operator', active: true, assignable: true };
  assert.equal(localContext.validatePlanningTaskForm({}, completedFormData, { uid: '', name: '' }, 'Pruebas'), '');
  localContext.window.currentUserProfile = { uid: 'viewer-1', role: 'viewer', active: true, assignable: true };
  assert.equal(localContext.validatePlanningTaskForm({}, completedFormData, { uid: 'selected-user', name: 'Responsable' }, 'Pruebas'), '');

  assert.match(planningUi, /id="planningCompletedStatusHint"/);
  assert.match(planningUi, /Esta tarea se registrará como terminada al momento de guardarla/);
  assert.match(planningUi, /onchange="handlePlanningCompletedStatusHint\(this\.value\)"/);
  assert.match(planningUi, /hint\.hidden = normalizedStatus !== "terminado" && normalizedStatus !== "terminada"/);
  assert.match(planningUi, /No es posible crear una tarea terminada sin un responsable válido\./);
  assert.match(planningUi, /!hasResponsible && !canCurrentUserClaimPlanningTask\(\)/);
  assert.match(planning, /prepareNewPlanningTaskForCreation\(preparePlanningTaskForSave\(task\), window\.currentUserProfile\)/);
  assert.match(planning, /const localTask = addPlanningTask\(savedTask, window\.currentUserProfile\)/);
  assert.match(planning, /"Estado": isPlanningTaskCompleted\(task\) \? "Terminado"/);
  assert.match(planning, /"Responsable": getPlanningTaskResponsibleName\(task\)/);
  assert.match(planning, /"Fecha inicio real": formatPlanningExportDate\(task\.inicioReal/);
  assert.match(planning, /"Fecha término real": formatPlanningExportDate\(task\.fechaTerminoReal \|\| task\.terminadoAt/);
  assert.match(planning, /"Duración": getPlanningDurationLabel\(task\)/);
  assert.match(planning, /"Modo asignación": task\.assignmentMode/);
});

test('weekly planning uses canonical UID, status, and planned-date rules for every responsible', () => {
  const localContext = createPlanningEngineContext();
  localContext.setPlanningResponsibleUsers([
    { uid: 'david-uid', name: 'David Salas' },
    { uid: 'juan-uid', name: 'Juan Carlos Almendras' },
    { uid: 'santiago-uid', name: 'Santiago ChacÃ³n' }
  ]);
  const week = '2026-W29';
  const tasks = [
    { id: 'david-pending', estado: ' Pendiente ', responsableId: 'david-uid', fechaInicioPlanificada: '2026-07-13' },
    { id: 'david-progress', estado: ' EN PROCESO ', responsibleUid: 'david-uid', fechaInicioPlanificada: '2026-07-14', fechaObjetivo: '' },
    { id: 'juan-progress-1', estado: 'En proceso', assignedBy: 'juan-uid', fechaObjetivo: '2026-07-15' },
    { id: 'juan-progress-2', estado: 'En proceso', responsableId: 'juan-uid', fechaInicioPlanificada: '2026-07-16' },
    { id: 'santiago-pending', estado: 'Pendiente', responsableId: 'santiago-uid', fechaInicioPlanificada: '2026-07-17' },
    { id: 'santiago-paused', estado: 'Pausada', responsableId: 'santiago-uid', fechaInicioPlanificada: '2026-07-17' },
    { id: 'santiago-done-1', estado: 'Terminado', responsableId: 'santiago-uid', fechaTerminoReal: '2026-07-17T12:00:00.000Z' },
    { id: 'santiago-done-2', estado: 'Terminada', responsableId: 'santiago-uid', completedAt: '2026-07-18T12:00:00.000Z' },
    { id: 'without-date', estado: 'En proceso', responsableId: 'david-uid' },
    { id: 'deleted', estado: 'En proceso', responsableId: 'david-uid', fechaInicioPlanificada: '2026-07-14', deleted: true },
    { id: 'other-module', estado: 'En proceso', responsableId: 'david-uid', fechaInicioPlanificada: '2026-07-14', module: 'production' }
  ];

  assert.deepEqual(localContext.getPlanningTasksForIsoWeek(tasks, week).map(task => task.id), [
    'david-pending', 'david-progress', 'juan-progress-1', 'juan-progress-2', 'santiago-pending', 'santiago-paused', 'santiago-done-1', 'santiago-done-2'
  ]);
  assert.equal(localContext.getPlanningTaskIsoWeekKey(tasks[8]), '');
  assert.equal(JSON.stringify(localContext.getPlanningWeeklyStatusCountsForResponsible(tasks, 'David Salas', week)), JSON.stringify({
    pendientes: 1, enProceso: 1, pausadas: 0, terminadas: 0, reprogramadas: 0
  }));
  assert.equal(JSON.stringify(localContext.getPlanningWeeklyStatusCountsForResponsible(tasks, 'juan-uid', week)), JSON.stringify({
    pendientes: 0, enProceso: 2, pausadas: 0, terminadas: 0, reprogramadas: 0
  }));
  assert.equal(JSON.stringify(localContext.getPlanningWeeklyStatusCountsForResponsible(tasks, 'Santiago ChacÃ³n', week)), JSON.stringify({
    pendientes: 1, enProceso: 0, pausadas: 1, terminadas: 2, reprogramadas: 0
  }));
  const grouped = localContext.groupPlanningTasksByUser(tasks.slice(0, 8));
  assert.equal(grouped['David Salas'].length, 2);
  assert.equal(grouped['Juan Carlos Almendras'].length, 2);
  assert.equal(grouped['Santiago ChacÃ³n'].length, 4);
});

test('admin executes other operators tasks without changing ownership while operators remain scoped', () => {
  const localContext = createPlanningUiContext();
  const davidTask = { id: 'david-task', estado: 'Pendiente', responsableId: 'david-uid', responsableNombre: 'David Salas', deleted: false };
  const admin = { uid: 'admin-uid', role: 'admin', active: true, assignable: false, name: 'Administrador' };
  const david = { uid: 'david-uid', role: 'operator', active: true, name: 'David Salas' };
  const otherOperator = { uid: 'juan-uid', role: 'operator', active: true, name: 'Juan Carlos Almendras' };

  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, admin, 'start'), true);
  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, david, 'start'), true);
  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, otherOperator, 'start'), false);
  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, { ...admin, active: false }, 'start'), false);
  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, { ...admin, role: 'viewer' }, 'start'), false);
  assert.equal(localContext.canCurrentUserExecutePlanningTask({ ...davidTask, estado: 'En proceso' }, admin, 'start'), false);
  assert.equal(localContext.canCurrentUserExecutePlanningTask(davidTask, admin, 'pause'), false);
  assert.equal(localContext.canCurrentUserExecutePlanningTask({ ...davidTask, estado: 'Pausada' }, admin, 'resume'), true);
  assert.equal(localContext.canCurrentUserExecutePlanningTask({ ...davidTask, estado: 'En proceso' }, admin, 'finish'), true);
  assert.match(planningUi, /getPlanningExecutionActions\(task, window\.currentUserProfile\)/);
  assert.match(planning, /executePlanningTaskActionInFirestore\(taskId, action, currentUser\)/);
  assert.match(firestore, /if \(role === "admin"\) return true/);
  assert.match(firestore, /terminadoBy = currentUserId/);
  assert.doesNotMatch(firestore.slice(firestore.indexOf('export async function executePlanningTaskAction'), firestore.indexOf('export async function adminTakeAndFinishPlanningTask')), /responsableId:\s*currentUserId/);
});
