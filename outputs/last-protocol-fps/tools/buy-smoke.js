// Browser QA through real controls; the only debug access is reading a copied snapshot.
(async () => {
  const click = async (label, exact = true) => {
    const button = [...document.querySelectorAll('button')].find(b => !b.disabled && (exact ? b.textContent.trim() === label : b.textContent.includes(label)));
    if (!button) throw new Error(`Missing enabled control: ${label}`);
    button.click(); await new Promise(resolve => setTimeout(resolve, 90));
  };
  const hero = () => window.__protocolDebug.read().snapshot.players.find(p => p.id === 'local');
  const results = [];
  await click('B / BUY EQUIPMENT'); await click('Armor'); await click('Ballistic vest', false);
  results.push({action:'buy vest',credits:hero().money,armor:hero().armor,pass:hero().money===150&&hero().armor===100});
  await click('REFUND LAST PURCHASE');
  results.push({action:'refund vest',credits:hero().money,armor:hero().armor,pass:hero().money===800&&hero().armor===0});
  await click('Sidearm'); await click('Rook .44', false);
  results.push({action:'buy sidearm',credits:hero().money,weapon:hero().loadout.sidearm,pass:hero().money===100&&hero().loadout.sidearm==='rook'});
  if (results.some(r => !r.pass)) throw new Error(JSON.stringify(results));
  return results;
})();
