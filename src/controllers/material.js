// src/controllers/material.js
const Material = require('../models/Material');
const MaterialMovimento = require('../models/MaterialMovimento');
const database = require('../db/init.js');

class MaterialController {
  buildOrder(sortBy, sortDir) {
    const allowed = new Set([
      'material',
      'tipo',
      'especificacao',
      'quantidade_disponivel',
      'quantidade_em_uso',
      'nf',
    ]);

    const safeSortBy = allowed.has(String(sortBy || '').trim()) ? String(sortBy).trim() : 'tipo';
    const safeSortDir = String(sortDir || '').trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    if (safeSortBy === 'tipo') {
      return [
        ['tipo', safeSortDir],
        ['material', 'ASC'],
      ];
    }

    return [
      [safeSortBy, safeSortDir],
      ['material', 'ASC'],
    ];
  }

  buildWhere({ tipo, somenteDisponivel, q } = {}) {
    const where = {};

    if (tipo && tipo.trim()) where.tipo = tipo.trim();

    if (q && q.trim()) {
      const { Op } = require('sequelize');
      const term = `%${q.trim()}%`;
      where[Op.or] = [
        { material: { [Op.like]: term } },
        { tipo: { [Op.like]: term } },
        { marca: { [Op.like]: term } },
        { especificacao: { [Op.like]: term } },
        { nf: { [Op.like]: term } },
      ];
    }

    if (somenteDisponivel === true) {
      const { Op } = require('sequelize');
      where.quantidade_disponivel = { [Op.gt]: 0 };
    }

    return where;
  }

  mapMaterial(m) {
    return {
      id: m.id,
      material: m.material,
      tipo: m.tipo,
      marca: m.marca,
      especificacao: m.especificacao,
      quantidade_disponivel: m.quantidade_disponivel,
      quantidade_em_uso: m.quantidade_em_uso,
      quantidade_baixada: m.quantidade_baixada,
      nf: m.nf,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  // LISTAR (com filtros opcionais)
  // filtros: tipo, somenteDisponivel (true/false), q (busca)
  async getAll({ tipo, somenteDisponivel, q, sortBy, sortDir } = {}) {
    const where = this.buildWhere({ tipo, somenteDisponivel, q });
    const order = this.buildOrder(sortBy, sortDir);

    const list = await Material.findAll({
      where,
      order,
    });

    return list.map((m) => this.mapMaterial(m));
  }

  async getPaged({ tipo, somenteDisponivel, q, page = 1, limit = 20, sortBy, sortDir } = {}) {
    const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20;
    const where = this.buildWhere({ tipo, somenteDisponivel, q });
    const order = this.buildOrder(sortBy, sortDir);

    const { count, rows } = await Material.findAndCountAll({
      where,
      order,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    });

    return {
      rows: rows.map((m) => this.mapMaterial(m)),
      total: Number(count || 0),
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(Number(count || 0) / safeLimit)),
    };
  }

  async getById(id) {
    const mat = await Material.findByPk(id);
    if (!mat) throw new Error('Material nao encontrado.');
    return mat;
  }

  async create(payload) {
    const {
      material,
      tipo,
      marca = null,
      especificacao = null,
      quantidade_disponivel = 0,
      quantidade_em_uso = 0,
      nf = null,
    } = payload;

    if (!material || !material.trim()) throw new Error('Campo "Material" e obrigatorio.');
    if (!tipo || !tipo.trim()) throw new Error('Campo "Tipo" e obrigatorio.');

    const qDisp = Number(quantidade_disponivel) || 0;
    const qUso = Number(quantidade_em_uso) || 0;

    if (qDisp < 0 || qUso < 0) throw new Error('Quantidades nao podem ser negativas.');

    const created = await Material.create({
      material: material.trim(),
      tipo: tipo.trim(),
      marca: marca?.trim?.() || marca,
      especificacao: especificacao?.trim?.() || especificacao,
      quantidade_disponivel: qDisp,
      quantidade_em_uso: qUso,
      nf: nf?.trim?.() || nf,
    });

    return created;
  }

  async update(id, payload) {
    const mat = await Material.findByPk(id);
    if (!mat) throw new Error('Material nao encontrado.');

    const fields = ['material', 'tipo', 'marca', 'especificacao', 'nf'];

    for (const f of fields) {
      if (payload[f] !== undefined) {
        mat[f] = typeof payload[f] === 'string' ? payload[f].trim() : payload[f];
      }
    }

    if (
      mat.quantidade_disponivel < 0 ||
      mat.quantidade_em_uso < 0 ||
      (mat.quantidade_baixada ?? 0) < 0
    ) {
      throw new Error('Quantidades nao podem ser negativas.');
    }

    if (!mat.material || !mat.material.trim()) throw new Error('Campo "Material" e obrigatorio.');
    if (!mat.tipo || !mat.tipo.trim()) throw new Error('Campo "Tipo" e obrigatorio.');

    await mat.save();
    return mat;
  }

  async getTipos() {
    const rows = await Material.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('tipo')), 'tipo']],
      order: [['tipo', 'ASC']],
    });

    return rows.map((r) => r.get('tipo')).filter((t) => t && String(t).trim().length > 0);
  }

  async usoPorMaquina(materialId) {
    const ManutencaoMaterial = require('../models/ManutencaoMaterial');
    const ManutencaoItem = require('../models/ManutencaoItem');
    const Manutencao = require('../models/Manutencao');
    const Computador = require('../models/Computador');
    const ComputadorMaterial = require('../models/ComputadorMaterial');

    const rows = await ManutencaoMaterial.findAll({
      where: { material_id: materialId },
      attributes: ['quantidade'],
      include: [
        {
          model: ManutencaoItem,
          as: 'manutencaoItem',
          attributes: ['id', 'tipo', 'manutencaoId'],
          include: [
            {
              model: Manutencao,
              as: 'manutencao',
              attributes: ['id', 'computadorId'],
              include: [
                {
                  model: Computador,
                  as: 'computador',
                  where: { ativo: true },
                  required: true,
                  attributes: ['id', 'patrimonio', 'specs', 'specs_override'],
                },
              ],
            },
          ],
        },
      ],
    });

    const map = new Map();

    for (const r of rows) {
      const item = r.manutencaoItem;
      if (!item) continue;
      if (item.tipo !== 'TROCA_PECA') continue;

      const manut = item.manutencao;
      const pc = manut?.computador;
      if (!pc) continue;

      const qtd = Number(r.quantidade || 0);
      if (!qtd) continue;

      const key = pc.id;

      if (!map.has(key)) {
        map.set(key, {
          computadorId: pc.id,
          patrimonio: pc.patrimonio || null,
          specs: pc.specs_override || pc.specs || null,
          unidade: 0,
        });
      }

      map.get(key).unidade += qtd;
    }

    const rowsEstruturados = await ComputadorMaterial.findAll({
      where: { material_id: materialId },
      attributes: ['quantidade'],
      include: [
        {
          model: Computador,
          as: 'computador',
          where: { ativo: true },
          required: true,
          attributes: ['id', 'patrimonio', 'specs', 'specs_override'],
        },
      ],
    });

    for (const r of rowsEstruturados) {
      const pc = r.computador;
      if (!pc) continue;

      const qtd = Number(r.quantidade || 0);
      if (!qtd) continue;

      const key = pc.id;

      if (!map.has(key)) {
        map.set(key, {
          computadorId: pc.id,
          patrimonio: pc.patrimonio || null,
          specs: pc.specs_override || pc.specs || null,
          unidade: 0,
        });
      }

      map.get(key).unidade += qtd;
    }

    const porMaquina = Array.from(map.values()).sort((a, b) => (b.unidade || 0) - (a.unidade || 0));

    return {
      materialId: Number(materialId),
      totalEmUso: porMaquina.reduce((acc, x) => acc + (x.unidade || 0), 0),
      porMaquina,
    };
  }

  async getMovimentos(materialId) {
    const mat = await Material.findByPk(materialId);
    if (!mat) throw new Error('Material nao encontrado.');

    const movs = await MaterialMovimento.findAll({
      where: { material_id: materialId },
      order: [['createdAt', 'DESC']],
    });

    return movs.map((m) => ({
      id: m.id,
      material_id: m.material_id,
      tipo_movimento: m.tipo_movimento,
      quantidade: m.quantidade,
      referencia_manutencaoItem_id: m.referencia_manutencaoItem_id,
      createdAt: m.createdAt,
    }));
  }

  async getRecuperados(materialId) {
    const Computador = require('../models/Computador');
    const ManutencaoItem = require('../models/ManutencaoItem');

    const mat = await Material.findByPk(materialId);
    if (!mat) throw new Error('Material nao encontrado.');

    const movs = await MaterialMovimento.findAll({
      where: {
        material_id: materialId,
        tipo_movimento: 'ENTRADA_RECUPERACAO',
      },
      order: [['createdAt', 'DESC']],
    });

    const recuperados = [];

    for (const m of movs) {
      let pc = null;
      let manutItem = null;

      if (m.referencia_computador_id) {
        pc = await Computador.findByPk(m.referencia_computador_id);
      }
      if (m.referencia_manutencaoItem_id) {
        manutItem = await ManutencaoItem.findByPk(m.referencia_manutencaoItem_id);
      }

      recuperados.push({
        id: m.id,
        quantidade: m.quantidade,
        origem: pc?.patrimonio || '-',
        specs: pc?.specs_override || pc?.specs || '-',
        createdAt: m.createdAt,
        observacao: m.observacao || '-',
        manutencaoItemId: m.referencia_manutencaoItem_id || null,
        manutencaoId: manutItem?.manutencaoId || null,
      });
    }

    return recuperados;
  }

  async baixar(payload) {
    const {
      materialId,
      quantidade = 1,
      origem,
      motivo,
      computadorId = null,
      manutencaoItemId = null,
    } = payload;

    if (!materialId) throw new Error('materialId e obrigatorio.');
    const qtd = Number(quantidade) || 0;
    if (qtd <= 0) throw new Error('Quantidade invalida.');

    if (origem !== 'DISPONIVEL' && origem !== 'EM_USO') {
      throw new Error("origem deve ser 'DISPONIVEL' ou 'EM_USO'.");
    }

    if (!motivo || !String(motivo).trim()) {
      throw new Error('Motivo da baixa e obrigatorio.');
    }

    if (origem === 'EM_USO' && !computadorId) {
      throw new Error('computadorId e obrigatorio quando origem = EM_USO.');
    }

    return await database.transaction(async (t) => {
      const mat = await Material.findByPk(materialId, { transaction: t });
      if (!mat) throw new Error('Material nao encontrado.');

      if (origem === 'DISPONIVEL') {
        if (mat.quantidade_disponivel < qtd) {
          throw new Error(`Saldo insuficiente em DISPONIVEL. Disponivel: ${mat.quantidade_disponivel}`);
        }
        mat.quantidade_disponivel -= qtd;
      } else {
        if (mat.quantidade_em_uso < qtd) {
          throw new Error(`Saldo insuficiente em EM USO. Em uso: ${mat.quantidade_em_uso}`);
        }
        mat.quantidade_em_uso -= qtd;
      }

      mat.quantidade_baixada = (mat.quantidade_baixada || 0) + qtd;

      if (
        mat.quantidade_disponivel < 0 ||
        mat.quantidade_em_uso < 0 ||
        mat.quantidade_baixada < 0
      ) {
        throw new Error('Quantidades nao podem ficar negativas.');
      }

      await mat.save({ transaction: t });

      await MaterialMovimento.create(
        {
          material_id: mat.id,
          tipo_movimento: 'BAIXA',
          quantidade: qtd,
          referencia_manutencaoItem_id: manutencaoItemId || null,
          referencia_computador_id: computadorId || null,
          observacao: String(motivo).trim(),
        },
        { transaction: t }
      );

      return true;
    });
  }

  async getBaixados(materialId) {
    const Computador = require('../models/Computador');
    const ManutencaoItem = require('../models/ManutencaoItem');

    const mat = await Material.findByPk(materialId);
    if (!mat) throw new Error('Material nao encontrado.');

    const movs = await MaterialMovimento.findAll({
      where: {
        material_id: materialId,
        tipo_movimento: 'BAIXA',
      },
      order: [['createdAt', 'DESC']],
    });

    const baixados = [];

    for (const m of movs) {
      let pc = null;
      let manutItem = null;

      if (m.referencia_computador_id) {
        pc = await Computador.findByPk(m.referencia_computador_id);
      }
      if (m.referencia_manutencaoItem_id) {
        manutItem = await ManutencaoItem.findByPk(m.referencia_manutencaoItem_id);
      }

      baixados.push({
        id: m.id,
        quantidade: m.quantidade,
        motivo: m.observacao || '-',
        origem: pc?.patrimonio || 'ESTOQUE',
        patrimonio: pc?.patrimonio || '-',
        specs: pc?.specs_override || pc?.specs || '-',
        createdAt: m.createdAt,
        manutencaoItemId: m.referencia_manutencaoItem_id || null,
        manutencaoId: manutItem?.manutencaoId || null,
      });
    }

    return baixados;
  }

  async recuperar(payload) {
    const { materialId, quantidade = 1, computadorId = null, manutencaoItemId = null } = payload;

    if (!materialId) throw new Error('materialId e obrigatorio.');

    const qtd = Number(quantidade) || 0;
    if (qtd <= 0) throw new Error('Quantidade invalida.');

    return await database.transaction(async (t) => {
      const mat = await Material.findByPk(materialId, { transaction: t });
      if (!mat) throw new Error('Material nao encontrado.');

      if (mat.quantidade_em_uso < qtd) {
        throw new Error(`Saldo insuficiente em EM USO. Em uso: ${mat.quantidade_em_uso}`);
      }

      mat.quantidade_em_uso -= qtd;
      mat.quantidade_disponivel += qtd;

      await mat.save({ transaction: t });

      await MaterialMovimento.create(
        {
          material_id: mat.id,
          tipo_movimento: 'ENTRADA_RECUPERACAO',
          quantidade: qtd,
          referencia_manutencaoItem_id: manutencaoItemId || null,
          referencia_computador_id: computadorId || null,
          observacao: 'Peca recuperada de manutencao',
        },
        { transaction: t }
      );

      return true;
    });
  }
}

module.exports = MaterialController;
