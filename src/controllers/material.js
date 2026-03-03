// src/controllers/material.js
const Material = require('../models/Material');
const MaterialMovimento = require('../models/MaterialMovimento');

class MaterialController {
  // LISTAR (com filtros opcionais)
  // filtros: tipo, somenteDisponivel (true/false), q (busca)
  async getAll({ tipo, somenteDisponivel, q } = {}) {
    const where = {};

    if (tipo && tipo.trim()) where.tipo = tipo.trim();

    // Busca simples em campos principais (LIKE)
    // Observação: SQLite + Sequelize: Op.like funciona.
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

    // Se somenteDisponivel = true -> quantidade_disponivel > 0
    if (somenteDisponivel === true) {
      const { Op } = require('sequelize');
      where.quantidade_disponivel = { [Op.gt]: 0 };
    }

    const list = await Material.findAll({ where, order: [['tipo', 'ASC'], ['material', 'ASC']] });

    return list.map((m) => ({
      id: m.id,
      material: m.material,
      tipo: m.tipo,
      marca: m.marca,
      especificacao: m.especificacao,
      quantidade_disponivel: m.quantidade_disponivel,
      quantidade_em_uso: m.quantidade_em_uso,
      nf: m.nf,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async getById(id) {
    const mat = await Material.findByPk(id);
    if (!mat) throw new Error('Material não encontrado.');
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

    if (!material || !material.trim()) throw new Error('Campo "Material" é obrigatório.');
    if (!tipo || !tipo.trim()) throw new Error('Campo "Tipo" é obrigatório.');

    // garante inteiros
    const qDisp = Number(quantidade_disponivel) || 0;
    const qUso = Number(quantidade_em_uso) || 0;

    if (qDisp < 0 || qUso < 0) throw new Error('Quantidades não podem ser negativas.');

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
    if (!mat) throw new Error('Material não encontrado.');

    const fields = ['material', 'tipo', 'marca', 'especificacao', 'quantidade_disponivel', 'nf'];

    for (const f of fields) {
      if (payload[f] !== undefined) {
        mat[f] = typeof payload[f] === 'string' ? payload[f].trim() : payload[f];
      }
    }

    // 🔒 3A (A3): quantidade_em_uso não é editável manualmente
    // (ela só muda via procedimentos/recuperação)

    // validações de quantidade
    if (mat.quantidade_disponivel < 0 || mat.quantidade_em_uso < 0) {
      throw new Error('Quantidades não podem ser negativas.');
    }

    if (!mat.material || !mat.material.trim()) throw new Error('Campo "Material" é obrigatório.');
    if (!mat.tipo || !mat.tipo.trim()) throw new Error('Campo "Tipo" é obrigatório.');

    await mat.save();
    return mat;
  }

  // Tipos distintos (pra preencher o select “tipo de peça”)
  async getTipos() {
    // SQLite: DISTINCT simples
    const rows = await Material.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('tipo')), 'tipo']],
      order: [['tipo', 'ASC']],
    });

    return rows
      .map((r) => r.get('tipo'))
      .filter((t) => t && String(t).trim().length > 0);
  }
  async usoPorMaquina(materialId) {
    const ManutencaoMaterial = require('../models/ManutencaoMaterial');
    const ManutencaoItem = require('../models/ManutencaoItem');
    const Manutencao = require('../models/Manutencao');
    const Computador = require('../models/Computador');

    const rows = await ManutencaoMaterial.findAll({
      where: { material_id: materialId },
      attributes: ['quantidade'],
      include: [{
        model: ManutencaoItem,
        as: 'manutencaoItem',
        attributes: ['id', 'tipo', 'manutencaoId'],
        include: [{
          model: Manutencao,
          as: 'manutencao',
          attributes: ['id', 'computadorId'],
          include: [{
            model: Computador,
            as: 'computador',
            where: { ativo: true },          // ✅ só ativos
            required: true,                  // ✅ força o filtro realmente
            attributes: ['id', 'patrimonio', 'specs', 'specs_override'],
          }],
        }],
      }],
    });

    // agrega por computador
    const map = new Map();

    for (const r of rows) {
      const item = r.manutencaoItem;
      if (!item) continue;

      // conta só troca de peça (pra não poluir com limpeza etc.)
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

    // ordena por “mais unidades” desc
    const porMaquina = Array.from(map.values()).sort((a, b) => (b.unidade || 0) - (a.unidade || 0));

    return {
      materialId: Number(materialId),
      totalEmUso: porMaquina.reduce((acc, x) => acc + (x.unidade || 0), 0),
      porMaquina,
    };
  }
  // Log de movimentos do material
  async getMovimentos(materialId) {
    const mat = await Material.findByPk(materialId);
    if (!mat) throw new Error('Material não encontrado.');

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
}

module.exports = MaterialController;