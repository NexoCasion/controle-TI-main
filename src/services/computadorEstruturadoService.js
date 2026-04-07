const fs = require('fs');

const database = require('../db/init');
const Computador = require('../models/Computador');
const Material = require('../models/Material');
const MaterialMovimento = require('../models/MaterialMovimento');
const ComputadorMaterial = require('../models/ComputadorMaterial');
const { parseHwinfoCsv, buildStructuredSpecsText } = require('./hwinfoCsvParser');
const { validarPatrimonioUnico } = require('./patrimonioUnicoService');

class ComputadorEstruturadoService {
  parseStructuredSpecs(rawValue) {
    if (!rawValue) return {};

    if (typeof rawValue === 'object') {
      return rawValue;
    }

    try {
      return JSON.parse(String(rawValue));
    } catch (error) {
      return {};
    }
  }

  inferCategoria(material = null, fallback = null) {
    if (fallback) return String(fallback).toUpperCase();

    const tipo = String(material?.tipo || '').toUpperCase();
    if (tipo.includes('PROCESSADOR')) return 'PROCESSADOR';
    if (tipo.includes('MEMORIA')) return 'MEMORIA';
    if (tipo.includes('FONTE')) return 'FONTE';
    if (
      tipo.includes('ARMAZENAMENTO') ||
      tipo.includes('SSD') ||
      tipo.includes('HDD') ||
      tipo.includes('NVME')
    ) {
      return 'ARMAZENAMENTO';
    }

    return 'OUTROS';
  }

  buildComponenteFromMaterial(material, categoria = null, quantidade = 1) {
    const categoriaFinal = this.inferCategoria(material, categoria);
    return {
      categoria: categoriaFinal,
      tipo: material.tipo,
      material: material.material,
      especificacao: material.especificacao || null,
      quantidade: Number(quantidade || 1),
    };
  }

  async getParsedFromComputador(computadorId, transaction) {
    const computador = await Computador.findByPk(computadorId, { transaction });
    if (!computador) throw new Error('Computador nao encontrado.');

    const stored = this.parseStructuredSpecs(computador.specs_estruturadas);
    const componentes = await ComputadorMaterial.findAll({
      where: { computador_id: computadorId },
      include: [{ model: Material, as: 'material' }],
      order: [['id', 'ASC']],
      transaction,
    });

    const parsed = {
      nomeComputador: stored.nomeComputador || null,
      marcaComputador: stored.marcaComputador || null,
      processador: null,
      memorias: [],
      armazenamentos: [],
      fontes: [],
    };

    componentes.forEach((item) => {
      if (!item.material) return;

      const componente = this.buildComponenteFromMaterial(
        item.material,
        item.categoria,
        item.quantidade
      );

      if (componente.categoria === 'PROCESSADOR' && !parsed.processador) {
        parsed.processador = componente;
        return;
      }

      if (componente.categoria === 'MEMORIA') {
        parsed.memorias.push(componente);
        return;
      }

      if (componente.categoria === 'ARMAZENAMENTO') {
        parsed.armazenamentos.push(componente);
        return;
      }

      if (componente.categoria === 'FONTE') {
        parsed.fontes.push(componente);
      }
    });

    return parsed;
  }

  async syncSpecsEstruturadasDoComputador(computadorId, transaction) {
    const computador = await Computador.findByPk(computadorId, { transaction });
    if (!computador) throw new Error('Computador nao encontrado.');

    const parsed = await this.getParsedFromComputador(computadorId, transaction);
    const specsText = buildStructuredSpecsText(parsed);

    computador.specs_modo = 'ESTRUTURADO';
    computador.specs_estruturadas = JSON.stringify(parsed);
    computador.specs = specsText || computador.specs || 'Computador estruturado';
    computador.specs_override = specsText || computador.specs_override || computador.specs;
    await computador.save({ transaction });

    return {
      parsed,
      specsText,
      computador,
    };
  }

  async substituirComponenteEstruturado({
    computadorId,
    materialInstaladoId,
    quantidadeInstalada = 1,
    materialRemovidoId,
    quantidadeRemovida = 1,
    transaction,
  }) {
    const quantidadeNova = Number(quantidadeInstalada || 1);
    const quantidadeVelha = Number(quantidadeRemovida || 1);

    const [materialInstalado, materialRemovido] = await Promise.all([
      Material.findByPk(materialInstaladoId, { transaction }),
      Material.findByPk(materialRemovidoId, { transaction }),
    ]);

    if (!materialInstalado) throw new Error('Material instalado nao encontrado.');
    if (!materialRemovido) throw new Error('Material removido nao encontrado.');

    const vinculosRemovidos = await ComputadorMaterial.findAll({
      where: {
        computador_id: computadorId,
        material_id: materialRemovidoId,
      },
      order: [['id', 'ASC']],
      transaction,
    });

    let restanteRemover = quantidadeVelha;
    let categoriaPreferencial = null;

    for (const vinculo of vinculosRemovidos) {
      const qtdVinculo = Number(vinculo.quantidade || 0);
      if (qtdVinculo <= 0) continue;

      categoriaPreferencial = categoriaPreferencial || vinculo.categoria || null;

      if (qtdVinculo > restanteRemover) {
        vinculo.quantidade = qtdVinculo - restanteRemover;
        await vinculo.save({ transaction });
        restanteRemover = 0;
        break;
      }

      restanteRemover -= qtdVinculo;
      await vinculo.destroy({ transaction });
      if (restanteRemover <= 0) break;
    }

    if (restanteRemover > 0) {
      throw new Error(
        `Componente estruturado removido nao encontrado em quantidade suficiente no computador. Faltou remover ${restanteRemover}.`
      );
    }

    const categoriaInstalada = this.inferCategoria(materialInstalado, categoriaPreferencial);

    const vinculoInstalado = await ComputadorMaterial.findOne({
      where: {
        computador_id: computadorId,
        material_id: materialInstaladoId,
        categoria: categoriaInstalada,
      },
      transaction,
    });

    if (vinculoInstalado) {
      vinculoInstalado.quantidade = Number(vinculoInstalado.quantidade || 0) + quantidadeNova;
      await vinculoInstalado.save({ transaction });
    } else {
      await ComputadorMaterial.create(
        {
          computador_id: computadorId,
          material_id: materialInstaladoId,
          quantidade: quantidadeNova,
          categoria: categoriaInstalada,
          origem: 'MANUTENCAO_TROCA',
        },
        { transaction }
      );
    }

    return this.syncSpecsEstruturadasDoComputador(computadorId, transaction);
  }

  async findOrCreateMaterial(componente, transaction) {
    const where = {
      tipo: componente.tipo,
      material: componente.material,
      especificacao: componente.especificacao || null,
    };

    let material = await Material.findOne({ where, transaction });

    if (!material) {
      material = await Material.create(
        {
          material: componente.material,
          tipo: componente.tipo,
          especificacao: componente.especificacao || null,
          quantidade_disponivel: 0,
          quantidade_em_uso: 0,
        },
        { transaction }
      );
    }

    return material;
  }

  detectStorageType(text = '') {
    return 'Armazenamento';
  }

  splitManualItems(text = '') {
    return String(text || '')
      .split(/\r?\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  applyFonteInformada(parsed = {}, fonte = '') {
    const fontesInformadas = this.splitManualItems(fonte);

    return {
      ...parsed,
      fontes: fontesInformadas.map((item) => ({
        categoria: 'FONTE',
        tipo: 'Fonte',
        material: 'Fonte',
        especificacao: item,
        quantidade: 1,
      })),
    };
  }

  buildParsedManual(payload = {}) {
    const modelo = String(payload.modeloComputador || '').trim();
    const processador = String(payload.processador || '').trim();
    const memoriasInformadas = this.splitManualItems(payload.memoria);
    const armazenamentosInformados = this.splitManualItems(payload.armazenamento);

    return {
      nomeComputador: null,
      marcaComputador: modelo || null,
      processador: processador
        ? {
            categoria: 'PROCESSADOR',
            tipo: 'Processador',
            material: processador,
            especificacao: processador,
            quantidade: 1,
          }
        : null,
      memorias: memoriasInformadas.map((memoria) => ({
        categoria: 'MEMORIA',
        tipo: 'Memoria',
        material: 'Memoria',
        especificacao: memoria,
        quantidade: 1,
      })),
      armazenamentos: armazenamentosInformados.map((armazenamento) => {
        const parts = armazenamento.split(/\s-\s(.+)/);
        const material = String(parts[0] || armazenamento).trim();
        const especificacao = String(parts[1] || '').trim() || null;

        return {
          categoria: 'ARMAZENAMENTO',
          tipo: this.detectStorageType(armazenamento),
          material,
          especificacao,
          quantidade: 1,
        };
      }),
      fontes: this.splitManualItems(payload.fonte).map((fonte) => ({
        categoria: 'FONTE',
        tipo: 'Fonte',
        material: 'Fonte',
        especificacao: fonte,
        quantidade: 1,
      })),
    };
  }

  normalizeComponentes(parsed) {
    return [
      ...(parsed.processador ? [parsed.processador] : []),
      ...(parsed.memorias || []),
      ...(parsed.armazenamentos || []),
      ...(parsed.fontes || []),
    ];
  }

  async registrarMovimentoEstruturado(material, computadorId, quantidade, tipoMovimento, observacao, transaction) {
    await MaterialMovimento.create(
      {
        material_id: material.id,
        tipo_movimento: tipoMovimento,
        quantidade,
        referencia_computador_id: computadorId,
        observacao,
      },
      { transaction }
    );
  }

  async rollbackComponentesAtuais(computadorId, transaction) {
    const atuais = await ComputadorMaterial.findAll({
      where: { computador_id: computadorId },
      include: [{ model: Material, as: 'material' }],
      transaction,
    });

    for (const item of atuais) {
      if (!item.material) continue;

      const quantidadeAtual = Number(item.material.quantidade_em_uso || 0);
      const quantidadeRemover = Number(item.quantidade || 0);

      if (quantidadeAtual < quantidadeRemover) {
        throw new Error(
          `Estoque inconsistente para ${item.material.material}: em uso ${quantidadeAtual}, tentando remover ${quantidadeRemover}.`
        );
      }

      item.material.quantidade_em_uso = quantidadeAtual - quantidadeRemover;
      await item.material.save({ transaction });
      await this.registrarMovimentoEstruturado(
        item.material,
        computadorId,
        quantidadeRemover,
        'SAIDA_ESTRUTURADO',
        'Reprocessamento de componentes estruturados do computador',
        transaction
      );
    }

    await ComputadorMaterial.destroy({
      where: { computador_id: computadorId },
      transaction,
    });
  }

  async aplicarEstruturaAoComputador(computador, parsed, origem = 'ESTRUTURADO_CSV', transaction) {
    const componentes = this.normalizeComponentes(parsed);

    if (!componentes.length) {
      throw new Error('Nenhum componente estruturado foi informado.');
    }

    await this.rollbackComponentesAtuais(computador.id, transaction);

    for (const componente of componentes) {
      const material = await this.findOrCreateMaterial(componente, transaction);
      const quantidade = Number(componente.quantidade || 1);

      material.quantidade_em_uso = Number(material.quantidade_em_uso || 0) + quantidade;
      await material.save({ transaction });
      await this.registrarMovimentoEstruturado(
        material,
        computador.id,
        quantidade,
        'ENTRADA_ESTRUTURADO',
        `Componente vinculado ao computador ${computador.patrimonio}`,
        transaction
      );

      await ComputadorMaterial.create(
        {
          computador_id: computador.id,
          material_id: material.id,
          quantidade,
          categoria: componente.categoria,
          origem,
        },
        { transaction }
      );
    }

    const specsText = buildStructuredSpecsText(parsed);

    computador.specs = specsText || computador.specs || 'Computador estruturado';
    computador.specs_modo = 'ESTRUTURADO';
    computador.specs_estruturadas = JSON.stringify(parsed);
    computador.specs_override = specsText || computador.specs_override;
    await computador.save({ transaction });

    return {
      computadorId: computador.id,
      specsModo: computador.specs_modo,
      componentesImportados: componentes.length,
      resumo: parsed,
      specsRenderizadas: specsText,
    };
  }

  async importarCsv(computadorId, csvContent, options = {}) {
    const parsed = this.applyFonteInformada(parseHwinfoCsv(csvContent), options.fonte);

    return await database.transaction(async (transaction) => {
      const computador = await Computador.findByPk(computadorId, { transaction });

      if (!computador) {
        throw new Error('Computador nao encontrado.');
      }

      return this.aplicarEstruturaAoComputador(computador, parsed, 'ESTRUTURADO_CSV', transaction);
    });
  }

  async criarComputadorEstruturado({ patrimonio, setor, empresaId, parsed, origem = 'ESTRUTURADO_MANUAL' }) {
    if (!empresaId) throw new Error('Empresa obrigatoria.');

    return await database.transaction(async (transaction) => {
      const patrimonioNormalizado = await validarPatrimonioUnico(patrimonio, { transaction });

      const computador = await Computador.create(
        {
          patrimonio: patrimonioNormalizado,
          specs: buildStructuredSpecsText(parsed) || 'Computador estruturado',
          empresaId: Number(empresaId),
          setor: String(setor || '').trim() || null,
        },
        { transaction }
      );

      const resultado = await this.aplicarEstruturaAoComputador(computador, parsed, origem, transaction);
      return {
        ...resultado,
        computador,
      };
    });
  }

  async criarComputadorEstruturadoManual(payload = {}) {
    const parsed = this.buildParsedManual(payload);
    return this.criarComputadorEstruturado({
      patrimonio: payload.patrimonio,
      setor: payload.setor,
      empresaId: payload.empresaId,
      parsed,
      origem: 'ESTRUTURADO_MANUAL',
    });
  }

  async estruturarComputadorExistenteManual(computadorId, payload = {}) {
    const parsed = this.buildParsedManual(payload);

    return await database.transaction(async (transaction) => {
      const computador = await Computador.findByPk(Number(computadorId), { transaction });

      if (!computador) {
        throw new Error('Computador nao encontrado.');
      }

      return this.aplicarEstruturaAoComputador(
        computador,
        parsed,
        'ESTRUTURADO_MANUAL',
        transaction
      );
    });
  }

  async criarComputadorEstruturadoPorCsv({ patrimonio, setor, empresaId, csvContent, fonte }) {
    const parsed = this.applyFonteInformada(parseHwinfoCsv(csvContent), fonte);
    return this.criarComputadorEstruturado({
      patrimonio,
      setor,
      empresaId,
      parsed,
      origem: 'ESTRUTURADO_CSV',
    });
  }

  async importarCsvDeArquivo(computadorId, csvPath, options = {}) {
    if (!csvPath || !String(csvPath).trim()) {
      throw new Error('csvPath nao informado.');
    }

    const content = fs.readFileSync(String(csvPath), 'utf-8');
    return this.importarCsv(computadorId, content, options);
  }
}

module.exports = ComputadorEstruturadoService;
