export class WriteConflict extends Error { constructor(){super('Данные изменены. Ваш ввод сохранён в форме. Скопируйте его и обновите страницу для сравнения.');this.name='WriteConflict'} }
export function editVersion(value:unknown):Date {
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value)))throw new WriteConflict();
 return new Date(value);
}
export function nextEditVersion(previous:Date){return new Date(Math.max(Date.now(),previous.getTime()+1))}
