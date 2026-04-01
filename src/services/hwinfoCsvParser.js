function cleanValue(value = '') {
  return String(value || '').replace(/^"+|"+$/g, '').trim();
}

function parseGbFromText(text = '') {
  const match = String(text).match(/(\d+(?:[.,]\d+)?)\s*GB/i);
  if (match) return `${match[1].replace(',', '.')} GB`;

  const mbMatch = String(text).match(/(\d+(?:[.,]\d+)?)\s*MBytes/i);
  if (!mbMatch) return null;

  const valueMb = Number(mbMatch[1].replace(',', '.'));
  if (!Number.isFinite(valueMb) || valueMb <= 0) return null;

  return `${Math.round(valueMb / 1024)} GB`;
}

function detectMemoryType(text = '') {
  const upper = String(text).toUpperCase();
  if (upper.includes('DDR5') || upper.includes('PC5-')) return 'DDR5';
  if (upper.includes('DDR4') || upper.includes('PC4-')) return 'DDR4';
  if (upper.includes('DDR3') || upper.includes('PC3-')) return 'DDR3';
  if (upper.includes('DDR2') || upper.includes('PC2-')) return 'DDR2';
  return null;
}

function detectStorageKind(section = '', model = '') {
  const text = `${section} ${model}`.toUpperCase();
  if (text.includes('DVD') || text.includes('OPTICA') || text.includes('OPTICAL')) return 'OPTICAL';
  if (text.includes('NVME')) return 'NVME';
  if (text.includes('SSD')) return 'SSD';
  return 'HDD';
}

function buildStorageMaterialName(model = '', kind = '') {
  const baseModel = String(model || '').trim();
  if (!baseModel) return baseModel;

  if (kind === 'NVME' && !baseModel.toUpperCase().includes('NVME')) {
    return `NVMe ${baseModel}`;
  }

  return baseModel;
}

function shouldIgnoreStorageModel(model = '') {
  const normalized = String(model || '').trim().toUpperCase();
  return normalized.includes('ST1000LX015-1U7172');
}

function parseCsvPair(line) {
  const match = String(line).match(/^"([^"]+):","(.*)"$/);
  if (!match) return null;

  return {
    key: cleanValue(match[1]),
    value: cleanValue(match[2]),
  };
}

function normalizeMemorySpec(raw = '') {
  const size = parseGbFromText(raw);
  const type = detectMemoryType(raw);
  return [size, type].filter(Boolean).join(' ');
}

function buildMemorySpecFromDetail(detail = {}) {
  const parts = [];

  if (detail.size) parts.push(detail.size);
  if (detail.type) parts.push(detail.type);
  if (detail.speed) parts.push(detail.speed);

  return parts.join(' ');
}

function pushCurrentDisk(armazenamentos, currentDisk) {
  if (!currentDisk) return;
  if (currentDisk.kind === 'OPTICAL') return;
  if (shouldIgnoreStorageModel(currentDisk.material)) return;
  armazenamentos.push(currentDisk);
}

function pushMemoryDetail(memorias, detail) {
  if (!detail) return;
  if (!detail.size && !detail.type) return;

  const especificacao = buildMemorySpecFromDetail(detail);
  if (!especificacao) return;

  memorias.push({
    categoria: 'MEMORIA',
    tipo: 'Memoria',
    material: 'Memoria',
    especificacao,
    quantidade: 1,
  });
}

function parseHwinfoCsv(content) {
  const rawLines = String(content || '')
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter((line) => line.length > 0);

  const lines = rawLines
    .map((line) => cleanValue(line))
    .filter((line) => line.length > 0);

  let processador = null;
  let nomeComputador = null;
  let marcaComputador = null;
  const memorias = [];
  const armazenamentos = [];
  let currentDiskSection = '';
  let currentDisk = null;
  let currentMemoryDetail = null;
  let sawDetailedMemory = false;

  for (let index = 0; index < rawLines.length; index++) {
    const rawLine = rawLines[index];
    const line = lines[index];
    const pair = parseCsvPair(rawLine);

    if (!pair && currentMemoryDetail) {
      pushMemoryDetail(memorias, currentMemoryDetail);
      currentMemoryDetail = null;
    }

    if (/^Unidades /i.test(line)) {
      currentDiskSection = line;
      continue;
    }

    if (/^Fileira:\s*\d+\s*-/i.test(line)) {
      if (sawDetailedMemory) continue;

      const raw = line.replace(/^Fileira:\s*\d+\s*-\s*/i, '').trim();
      memorias.push({
        categoria: 'MEMORIA',
        tipo: 'Memoria',
        material: 'Memoria',
        especificacao: normalizeMemorySpec(raw) || raw,
        bruto: raw,
        quantidade: 1,
      });
      continue;
    }

    if (pair) {
      if (pair.key === 'Nome do computador') {
        nomeComputador = pair.value;
        continue;
      }

      if (pair.key === 'Nome da marca do computador') {
        marcaComputador = pair.value;
        continue;
      }

      if (pair.key === 'Nome do processador') {
        processador = pair.value;
        continue;
      }

      if (pair.key === 'Tamanho do dispositivo') {
        if (currentMemoryDetail) {
          pushMemoryDetail(memorias, currentMemoryDetail);
        }

        currentMemoryDetail = {
          size: parseGbFromText(pair.value),
          type: null,
          speed: null,
        };
        sawDetailedMemory = true;
        continue;
      }

      if (currentMemoryDetail && pair.key === 'Tipo de dispositivo') {
        currentMemoryDetail.type = detectMemoryType(pair.value);
        continue;
      }

      if (currentMemoryDetail && pair.key === 'Velocidade da memória') {
        currentMemoryDetail.speed = pair.value;
        continue;
      }

      if (currentMemoryDetail && pair.key === 'Configured Memory Speed' && !currentMemoryDetail.speed) {
        currentMemoryDetail.speed = pair.value;
        continue;
      }

      if (pair.key === 'Modelo de unidade') {
        pushCurrentDisk(armazenamentos, currentDisk);

        const model = pair.value;
        const kind = detectStorageKind(currentDiskSection, model);
        currentDisk = {
          categoria: 'ARMAZENAMENTO',
          tipo: 'Armazenamento',
          material: buildStorageMaterialName(model, kind),
          especificacao: '',
          quantidade: 1,
          kind,
        };
        continue;
      }

      if (pair.key === 'Modelo de unidade óptica' || pair.key === 'Modelo de unidade optica') {
        pushCurrentDisk(armazenamentos, currentDisk);
        currentDisk = null;
        continue;
      }

      if (currentDisk && pair.key === 'Capacidade de unidade') {
        currentDisk.especificacao = pair.value;
        continue;
      }
    }
  }

  pushMemoryDetail(memorias, currentMemoryDetail);
  pushCurrentDisk(armazenamentos, currentDisk);

  if (!processador) {
    const fallbackCpu = lines.find((line) => /^Intel |^AMD |^Ryzen |^Core /i.test(line));
    if (fallbackCpu) processador = fallbackCpu;
  }

  return {
    nomeComputador,
    marcaComputador,
    processador: processador
      ? {
          categoria: 'PROCESSADOR',
          tipo: 'Processador',
          material: processador,
          especificacao: processador,
          quantidade: 1,
        }
      : null,
    memorias,
    armazenamentos: armazenamentos.map(({ kind, ...item }) => item),
    fontes: [],
  };
}

function buildStructuredSpecsText(parsed) {
  const linhas = [];

  if (parsed.marcaComputador) {
    linhas.push(`Modelo: ${parsed.marcaComputador}`);
  }

  if (parsed.processador) {
    linhas.push(`Processador: ${parsed.processador.material}`);
  }

  if (parsed.memorias.length) {
    linhas.push(
      `Memoria: ${parsed.memorias.map((mem) => mem.especificacao || mem.material).join(' | ')}`
    );
  }

  if (parsed.armazenamentos.length) {
    linhas.push(
      `Armazenamento: ${parsed.armazenamentos
        .map((item) => [item.material, item.especificacao].filter(Boolean).join(' - '))
        .join(' | ')}`
    );
  }

  if ((parsed.fontes || []).length) {
    linhas.push(
      `Fonte: ${(parsed.fontes || [])
        .map((item) => item.especificacao || item.material)
        .filter(Boolean)
        .join(' | ')}`
    );
  }

  return linhas.join('\n');
}

function parseComputerIdentityFromFilename(filename = '') {
  const baseName = String(filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.csv$/i, '')
    .trim();

  const parts = baseName.split('-').map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      'Nome do arquivo fora do padrao esperado. Use patrimonio-setor.csv, ex: 0003-TESTESETOR.csv.'
    );
  }

  const patrimonio = parts.shift();
  const setor = parts.join('-');

  if (!patrimonio || !setor) {
    throw new Error(
      'Nao foi possivel identificar patrimonio e setor pelo nome do arquivo. Use patrimonio-setor.csv.'
    );
  }

  return {
    patrimonio,
    setor,
    nomeBase: baseName,
  };
}

module.exports = {
  parseHwinfoCsv,
  buildStructuredSpecsText,
  parseComputerIdentityFromFilename,
};
