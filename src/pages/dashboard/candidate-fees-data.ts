export function feeAmount(value:unknown,currency?:string|null){
 if((typeof value!=='number'&&typeof value!=='string')||value==null||String(value).trim()===''||!Number.isFinite(Number(value)))return 'Not recorded';
 const number=Number(value);
 if(currency&&/^[A-Z]{3}$/.test(currency))try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(number)}catch{/* Preserve the saved value for an unsupported currency. */}
 return new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(number)+(currency?` ${currency}`:'');
}
