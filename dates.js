const date = new Date("2024-07-24T05:35:49-04:00");
const sunrise = new Date("2024-07-24T09:35:48+00:00");
const newDate = new Date();

console.log(date);
console.log(date.toISOString());
console.log(sunrise);
console.log(sunrise.toISOString());
console.log(newDate);
console.log(newDate.toISOString());
console.log(`${date.toISOString > sunrise.toISOString()}`);