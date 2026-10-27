import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'quickzu-app',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
const ADMIN = 'AaO71KqiEtYpivEEMOfkbQH31i63';
await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), 'products/p1'), { name: 'Jollof', price: 2500, category: 'Main' });
  await setDoc(doc(c.firestore(), 'orders/o1'), { customerName: 'A', status: 'pending', ownerUid: 'guest1' });
});
const anon = env.unauthenticatedContext().firestore();
// Customers are signed in anonymously by public/index.html.
const guest = env.authenticatedContext('guest1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const other = env.authenticatedContext('someoneElse', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const admin = env.authenticatedContext(ADMIN).firestore();

// Exactly what public/index.html writes.
const order = (o = {}) => ({
  ownerUid: 'guest1', orderId: '#123456', customerName: 'Musa', phone: '08012345678', type: 'DELIVERY', amount: 3500,
  payMode: 'Paid Online', address: 'Wuse 2', items: ['Jollof x 1'], time: 'Oct 26 01:00 PM',
  status: 'pending', createdAt: serverTimestamp(), ...o,
});

let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, e.message); } }

await t('public reads menu', assertSucceeds(getDocs(collection(anon, 'products'))));
await t('public reads settings', assertSucceeds(getDoc(doc(anon, 'settings/restaurant'))));
await t('public cannot edit menu', assertFails(setDoc(doc(anon, 'products/x'), { name: 'x', price: 1 })));
await t('other user cannot edit menu', assertFails(updateDoc(doc(other, 'products/p1'), { price: 1 })));
await t('signed-in guest places order', assertSucceeds(addDoc(collection(guest, 'orders'), order())));
await t('signed-out visitor cannot place order', assertFails(addDoc(collection(anon, 'orders'), order())));
await t('guest cannot place order for another uid', assertFails(addDoc(collection(other, 'orders'), order())));
await t('order without ownerUid rejected', assertFails(addDoc(collection(guest, 'orders'), (({ ownerUid, ...rest }) => rest)(order()))));
await t('guest tracks own order', assertSucceeds(getDoc(doc(guest, 'orders/o1'))));
await t('other guest cannot read the order', assertFails(getDoc(doc(other, 'orders/o1'))));
await t('guest cannot list orders', assertFails(getDocs(collection(guest, 'orders'))));
await t('guest cannot self-mark paid', assertFails(addDoc(collection(guest, 'orders'), order({ status: 'paid' }))));
await t('guest cannot add extra fields', assertFails(addDoc(collection(guest, 'orders'), order({ hacked: true }))));
await t('guest cannot fake createdAt', assertFails(addDoc(collection(guest, 'orders'), order({ createdAt: new Date(0) }))));
await t('120-char name accepted', assertSucceeds(addDoc(collection(guest, 'orders'), order({ customerName: 'N'.repeat(120) }))));
await t('121-char name rejected', assertFails(addDoc(collection(guest, 'orders'), order({ customerName: 'N'.repeat(121) }))));
await t('guest cannot update order', assertFails(updateDoc(doc(guest, 'orders/o1'), { status: 'done' })));
await t('guest cannot delete order', assertFails(deleteDoc(doc(guest, 'orders/o1'))));
await t('admin lists orders by createdAt', assertSucceeds(getDocs(query(collection(admin, 'orders'), orderBy('createdAt', 'desc')))));
await t('admin updates status', assertSucceeds(updateDoc(doc(admin, 'orders/o1'), { status: 'accepted' })));
await t('admin cannot change order amount', assertFails(updateDoc(doc(admin, 'orders/o1'), { amount: 1 })));
await t('admin adds product', assertSucceeds(addDoc(collection(admin, 'products'), { name: 'Rice', price: 2000, category: '', imageUrl: '', createdAt: serverTimestamp() })));
await t('admin adds category', assertSucceeds(addDoc(collection(admin, 'categories'), { name: 'Soups', createdAt: serverTimestamp() })));
await t('admin saves settings', assertSucceeds(setDoc(doc(admin, 'settings/restaurant'), { restaurantName: 'E.M', updatedAt: serverTimestamp() }, { merge: true })));
await t('other user cannot list orders', assertFails(getDocs(collection(other, 'orders'))));
await t('unknown collection closed', assertFails(getDocs(collection(anon, 'users'))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
