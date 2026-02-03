(function () {
  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res.json();
  }

  async function initManutencaoForm(root) {
    if (!root) return;
    if (root.dataset.manutencaoInit === '1') return;

    const empresaSelect = root.querySelector('#empresa');
    const computadorSelect = root.querySelector('#computador');
    const computadorGroup = root.querySelector('#computadorGroup');
    if (!empresaSelect || !computadorSelect || !computadorGroup) return;

    root.dataset.manutencaoInit = '1';

    async function carregarEmpresas() {
      const empresas = await fetchJson('/get-empresas');
      empresaSelect.innerHTML = `<option value="" selected disabled>Selecione a Empresa</option>`;
      (empresas || []).forEach((empresa) => {
        const opt = document.createElement('option');
        opt.value = empresa.id;
        opt.textContent = empresa.nome;
        empresaSelect.appendChild(opt);
      });
    }

    async function carregarComputadores(empresaId) {
      computadorSelect.innerHTML = `<option value="" selected disabled>Selecione o Computador</option>`;
      if (!empresaId) {
        computadorGroup.style.display = 'none';
        return;
      }

      const computadores = await fetchJson(
        `/computadores-by-empresa?empresaId=${encodeURIComponent(empresaId)}`
      );
      (computadores || []).forEach((computador) => {
        const opt = document.createElement('option');
        opt.value = computador.id;
        opt.textContent = `${computador.id} - ${computador.patrimonio}`;
        computadorSelect.appendChild(opt);
      });

      computadorGroup.style.display = '';
    }

    empresaSelect.addEventListener('change', async () => {
      try {
        await carregarComputadores(empresaSelect.value);
      } catch (e) {
        console.error('Erro ao carregar computadores:', e);
      }
    });

    try {
      await carregarEmpresas();
    } catch (e) {
      console.error('Erro ao carregar empresas:', e);
    }
  }

  window.initManutencaoForm = initManutencaoForm;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-manutencao-form]').forEach((el) => initManutencaoForm(el));
  });

  document.addEventListener('shown.bs.modal', (ev) => {
    const modal = ev.target;
    if (!modal) return;
    modal.querySelectorAll('[data-manutencao-form]').forEach((el) => initManutencaoForm(el));
  });
})();
