const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const engine = fs.readFileSync(path.join(__dirname, 'planning-engine.js'), 'utf8');
const firestore = fs.readFileSync(path.join(__dirname, '..', '..', 'auth', 'firestore.js'), 'utf8');
const context = { console, Date, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(engine, context);

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
});
