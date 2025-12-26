console.log('TEST: Script chargé');

document.addEventListener('DOMContentLoaded', () => {
    console.log('TEST: DOM prêt');
    const btn = document.getElementById('generateBtn');
    console.log('TEST: Button trouvé:', btn);
    if (btn) {
        btn.addEventListener('click', () => {
            console.log('TEST: Bouton cliqué!');
            alert('Le bouton fonctionne!');
        });
    }
});
