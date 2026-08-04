const database = require('../db/init.js');

const Manutencao = require('../models/Manutencao');
const ManutencaoItem = require('../models/ManutencaoItem');
const Computador = require('../models/Computador');

const Material = require('../models/Material');
const ManutencaoMaterial = require('../models/ManutencaoMaterial');
const MaterialMovimento = require('../models/MaterialMovimento');
const ComputadorMaterial = require('../models/ComputadorMaterial');
const Empresa = require('../models/Empresa');
const ComputadorEstruturadoService = require('../services/computadorEstruturadoService');

class ManutencaoController {
  constructor() {
    this.computadorEstruturadoService = new ComputadorEstruturadoService();
  }

  async podeSemearMaterialRemovido(materialId, quantidade, transaction) {
    const material = await Material.findByPk(materialId, { transaction });
    if (!material) return false;

    const qtd = Number(quantidade || 0);
    if (qtd <= 0) return false;

    const semSaldos =
      Number(material.quantidade_disponivel || 0) === 0 &&
      Number(material.quantidade_em_uso || 0) === 0 &&
      Number(material.quantidade_baixada || 0) === 0;

    if (!semSaldos) return false;

    const [movimentos, usosManutencao, usosEstruturados] = await Promise.all([
      MaterialMovimento.count({ where: { material_id: materialId }, transaction }),
      ManutencaoMaterial.count({ where: { material_id: materialId }, transaction }),
      ComputadorMaterial.count({ where: { material_id: materialId }, transaction }),
    ]);

    return movimentos === 0 && usosManutencao === 0 && usosEstruturados === 0;
  }

  async consumirEmUsoOuSemear(material, quantidade, transaction) {
    const qtd = Number(quantidade || 0);
    const emUsoAtual = Number(material.quantidade_em_uso || 0);

    if (emUsoAtual >= qtd) {
      material.quantidade_em_uso = emUsoAtual - qtd;
      return;
    }

    const podeSemear = await this.podeSemearMaterialRemovido(material.id, qtd, transaction);
    if (!podeSemear) {
      throw new Error(
        `Estoque inconsistente para ${material.material}: EM USO ${emUsoAtual}, tentativa de saida ${qtd}.`
      );
    }

    material.quantidade_em_uso = 0;
  }

  async consumirEmUsoEstrito(material, quantidade, transaction) {
    const qtd = Number(quantidade || 0);
    if (qtd <= 0) throw new Error('Quantidade inválida para retirada do em uso.');

    const emUsoAtual = Number(material.quantidade_em_uso || 0);
    if (emUsoAtual < qtd) {
      throw new Error(
        `Inconsistência no estoque do componente removido. Em uso atual: ${emUsoAtual}, solicitado: ${qtd}.`
      );
    }

    material.quantidade_em_uso = emUsoAtual - qtd;
    await material.save({ transaction });
  }

  async sincronizarEmUsoMinimoPorEstrutura(material, transaction) {
    const totalEstruturado = Number(
      (await ComputadorMaterial.sum('quantidade', {
        where: { material_id: Number(material.id) },
        transaction,
      })) || 0
    );

    const emUsoAtual = Number(material.quantidade_em_uso || 0);
    if (emUsoAtual >= totalEstruturado) {
      return emUsoAtual;
    }

    material.quantidade_em_uso = totalEstruturado;
    await material.save({ transaction });
    return totalEstruturado;
  }

  async consumirEmUsoEstruturado(material, computadorId, quantidade, transaction) {
    const qtd = Number(quantidade || 0);
    if (qtd <= 0) throw new Error('Quantidade inválida para retirada do em uso.');

    const quantidadeNoComputador = await this.getQuantidadeEstruturadaNoComputador(
      computadorId,
      material.id,
      transaction
    );

    if (quantidadeNoComputador < qtd) {
      throw new Error(
        `A máquina não possui esse componente em quantidade suficiente. Vinculado: ${quantidadeNoComputador}.`
      );
    }

    const emUsoAtual = await this.sincronizarEmUsoMinimoPorEstrutura(material, transaction);
    if (emUsoAtual < qtd) {
      throw new Error(
        `Inconsistência no estoque do componente removido. Em uso atual: ${emUsoAtual}, solicitado: ${qtd}.`
      );
    }

    material.quantidade_em_uso = emUsoAtual - qtd;
    await material.save({ transaction });
  }

  async getQuantidadeEstruturadaNoComputador(computadorId, materialId, transaction) {
    const vinculos = await ComputadorMaterial.findAll({
      where: {
        computador_id: Number(computadorId),
        material_id: Number(materialId),
      },
      transaction,
    });

    return vinculos.reduce((acc, vinculo) => acc + Number(vinculo.quantidade || 0), 0);
  }

  async removerQuantidadeEstruturadaDoComputador(computadorId, materialId, quantidade, transaction) {
    const qtd = Number(quantidade || 0);
    if (qtd <= 0) throw new Error('Quantidade inválida para remoção estrutural.');

    const vinculos = await ComputadorMaterial.findAll({
      where: {
        computador_id: Number(computadorId),
        material_id: Number(materialId),
      },
      order: [['id', 'ASC']],
      transaction,
    });

    let restante = qtd;

    for (const vinculo of vinculos) {
      const qtdVinculo = Number(vinculo.quantidade || 0);
      if (qtdVinculo <= 0) continue;

      if (qtdVinculo > restante) {
        vinculo.quantidade = qtdVinculo - restante;
        await vinculo.save({ transaction });
        restante = 0;
        break;
      }

      restante -= qtdVinculo;
      await vinculo.destroy({ transaction });
      if (restante <= 0) break;
    }

    if (restante > 0) {
      throw new Error(
        `A máquina não possui esse componente em quantidade suficiente. Faltou remover ${restante}.`
      );
    }
  }

  async getComponentesEstruturadosDoComputador(computadorId, tipo = null, transaction = null, options = {}) {
    const computador = await Computador.findByPk(Number(computadorId), { transaction });
    if (!computador) throw new Error('Computador não encontrado.');

    const estruturado = String(computador.specs_modo || 'LEGADO').toUpperCase() === 'ESTRUTURADO';
    const includePlaceholders = !!options.includePlaceholders;
    if (!estruturado) throw new Error('Computador não está em modo estruturado.');

    const whereMaterial = {};
    if (tipo && String(tipo).trim()) {
      whereMaterial.tipo = String(tipo).trim();
    }

    const vinculos = await ComputadorMaterial.findAll({
      where: { computador_id: Number(computadorId) },
      include: [
        {
          model: Material,
          as: 'material',
          required: true,
          where: whereMaterial,
        },
      ],
      transaction,
      order: [
        [{ model: Material, as: 'material' }, 'tipo', 'ASC'],
        [{ model: Material, as: 'material' }, 'material', 'ASC'],
      ],
    });

    const agrupado = new Map();

    vinculos.forEach((vinculo) => {
      const material = vinculo.material;
      if (!material) return;

      const qtd = Number(vinculo.quantidade || 0);
      if (qtd <= 0) return;

      if (!agrupado.has(material.id)) {
        agrupado.set(material.id, {
          id: material.id,
          tipo: material.tipo,
          material: material.material,
          marca: material.marca,
          especificacao: material.especificacao,
          quantidade_no_computador: 0,
          quantidade_disponivel: Number(material.quantidade_disponivel || 0),
          quantidade_em_uso: Number(material.quantidade_em_uso || 0),
        });
      }

      const atual = agrupado.get(material.id);
      atual.quantidade_no_computador += qtd;
    });

    const componentes = Array.from(agrupado.values());

    if (includePlaceholders) {
      const parsed = await this.computadorEstruturadoService.getParsedFromComputador(
        Number(computadorId),
        transaction
      );
      const placeholders = [
        parsed.processador,
        ...(parsed.memorias || []),
        ...(parsed.armazenamentos || []),
        ...(parsed.fontes || []),
      ].filter((item) => item && item.placeholder);

      ['PROCESSADOR', 'MEMORIA', 'ARMAZENAMENTO', 'FONTE'].forEach((categoria) => {
        const placeholderPadrao = this.computadorEstruturadoService.buildPlaceholderComponente(categoria);
        if (!placeholderPadrao) return;

        const jaExisteTipoReal = componentes.some(
          (componente) => String(componente.tipo || '').trim() === String(placeholderPadrao.tipo || '').trim()
        );
        const jaExistePlaceholder = placeholders.some(
          (item) => String(item.categoria || '').trim().toUpperCase() === categoria
        );

        if (!jaExisteTipoReal && !jaExistePlaceholder) {
          placeholders.push(placeholderPadrao);
        }
      });

      placeholders.forEach((item) => {
        const tipoPlaceholder = String(item.tipo || '').trim();
        if (!tipoPlaceholder) return;
        if (tipo && String(tipo).trim() && tipoPlaceholder !== String(tipo).trim()) return;

        const jaExisteTipo = componentes.some(
          (componente) => String(componente.tipo || '').trim() === tipoPlaceholder
        );
        if (jaExisteTipo) return;

        componentes.push({
          id: `placeholder:${item.categoria}`,
          tipo: item.tipo,
          material: item.material,
          marca: null,
          especificacao: item.especificacao,
          quantidade_no_computador: 0,
          quantidade_disponivel: 0,
          quantidade_em_uso: 0,
          categoria: item.categoria,
          placeholder: true,
        });
      });
    }

    return componentes.sort((a, b) => {
      const tipoDiff = String(a.tipo || '').localeCompare(String(b.tipo || ''));
      if (tipoDiff !== 0) return tipoDiff;
      return String(a.material || '').localeCompare(String(b.material || ''));
    });
  }

  async create(descricao, computadorId) {
    if (!computadorId) {
      throw new Error('Não foi informado um computador para registrar a manutenção!');
    }

    const manutencaoAbertaExistente = await Manutencao.findOne({
      where: {
        computadorId,
        dataSaida: null,
      },
    });

    if (manutencaoAbertaExistente) {
      throw new Error(
        `Este computador ja possui uma manutencao em aberto (ID ${manutencaoAbertaExistente.id}). Feche a manutencao atual antes de abrir outra.`
      );
    }

    const pc = await Computador.findByPk(computadorId);
    if (!pc) throw new Error('Computador não encontrado.');

    if (pc.status !== null && pc.status !== undefined) {
      throw new Error('Este computador está CONDENADO e não pode abrir novas manutenções.');
    }

    if (String(pc.specs_modo || 'LEGADO').toUpperCase() !== 'ESTRUTURADO') {
      throw new Error('Converta esta máquina legado para estruturado antes de abrir uma nova manutenção.');
    }

    const manutencao = await Manutencao.create({
      descricao,
      computadorId,
    });

    return manutencao;
  }

  async findOpened() {
    try {
      const manutencoesList = await Manutencao.findAll({
        where: { dataSaida: null },
      });

      const manutencoesJSON = manutencoesList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        computadorId: manutencao.dataValues.computadorId,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
      }));

      return manutencoesJSON;
    } catch (err) {
      throw new Error(`Erro ao buscar manutenções abertas: ${err.message}`);
    }
  }

  async findAll() {
    try {
      const manutencoesList = await Manutencao.findAll({
        include: [
          {
            model: Computador,
            as: 'computador',
            include: [
              { model: Empresa, as: 'empresa', attributes: ['nome'] }, // Adicione o alias aqui
            ],
          },
        ],
      });
      const manutencoesJSON = manutencoesList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        computadorId: manutencao.dataValues.computadorId,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
        empresa: manutencao.computador.empresa.nome,
        pcName: manutencao.computador.patrimonio,
        setor: manutencao.computador.setor,
        local: manutencao.computador.setor,

        // ✅ NOVO (para a tela saber se o PC foi condenado)
        pcStatus: manutencao.computador.status, // aqui fica o ID da manutenção que condenou
        pcCondenado: manutencao.computador.status !== null,
      }));
      return manutencoesJSON;
    } catch (error) {
      throw new Error(`Erro ao listar manutenções: ${error.message}`);
    }
  }

  async getPaged({
    page = 1,
    limit = 20,
    q = '',
    empresa = 'todas',
    status = 'todas_sem_condenados',
    dataInicio = '',
    dataFim = '',
    sortBy = 'id',
    sortDir = 'ASC',
  } = {}) {
    try {
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 200);
      const busca = String(q || '').trim().toLowerCase();
      const empresaFiltro = String(empresa || 'todas');
      const statusFiltro = String(status || 'todas_sem_condenados');
      const dataInicioFiltro = String(dataInicio || '').trim();
      const dataFimFiltro = String(dataFim || '').trim();

      const lista = await this.findAll();

      let filtrada = lista.filter((manutencao) => {
        const dataManutencao =
          manutencao.dataSaida && String(manutencao.dataSaida).trim() !== ''
            ? manutencao.dataSaida
            : manutencao.dataEntrada;

        const statusLinha = manutencao.dataSaida ? 'finalizadas' : 'em_manutencao';
        const condenado = !!manutencao.pcCondenado;
        const empresaLinha = manutencao.empresa || '';
        const textoBusca = [
          manutencao.id,
          manutencao.pcName,
          manutencao.empresa,
          manutencao.local || manutencao.setor,
          manutencao.descricao,
          manutencao.computadorId,
        ]
          .filter((v) => v !== undefined && v !== null)
          .join(' ')
          .toLowerCase();

        let statusMatch = true;
        if (statusFiltro === 'em_manutencao') {
          statusMatch = statusLinha === 'em_manutencao' && !condenado;
        } else if (statusFiltro === 'finalizadas_sem_condenacao') {
          statusMatch = statusLinha === 'finalizadas' && !condenado;
        } else if (statusFiltro === 'condenados') {
          statusMatch = condenado;
        } else if (statusFiltro === 'todas_sem_condenados') {
          statusMatch = !condenado;
        }

        const empresaMatch = empresaFiltro === 'todas' || empresaLinha === empresaFiltro;
        const buscaMatch = !busca || textoBusca.includes(busca);

        let dataMatch = true;
        const rowDate = dataManutencao ? new Date(dataManutencao) : null;
        if (dataInicioFiltro) {
          const de = new Date(`${dataInicioFiltro}T00:00:00`);
          dataMatch = dataMatch && rowDate && rowDate >= de;
        }
        if (dataFimFiltro) {
          const ate = new Date(`${dataFimFiltro}T23:59:59.999`);
          dataMatch = dataMatch && rowDate && rowDate <= ate;
        }

        return statusMatch && empresaMatch && buscaMatch && dataMatch;
      });

      const direction = String(sortDir).toUpperCase() === 'DESC' ? -1 : 1;

      filtrada.sort((a, b) => {
        const dataA =
          a.dataSaida && String(a.dataSaida).trim() !== '' ? a.dataSaida : a.dataEntrada;
        const dataB =
          b.dataSaida && String(b.dataSaida).trim() !== '' ? b.dataSaida : b.dataEntrada;

        let valorA = '';
        let valorB = '';

        if (sortBy === 'patrimonio') {
          valorA = a.pcName || '';
          valorB = b.pcName || '';
        } else if (sortBy === 'empresa') {
          valorA = a.empresa || '';
          valorB = b.empresa || '';
        } else if (sortBy === 'descricao') {
          valorA = a.descricao || '';
          valorB = b.descricao || '';
        } else if (sortBy === 'status') {
          valorA = a.pcCondenado ? 'condenado' : (a.dataSaida ? 'finalizada' : 'em_manutencao');
          valorB = b.pcCondenado ? 'condenado' : (b.dataSaida ? 'finalizada' : 'em_manutencao');
        } else if (sortBy === 'data') {
          valorA = dataA || '';
          valorB = dataB || '';
        } else {
          valorA = String(a.id || '');
          valorB = String(b.id || '');
        }

        if (sortBy === 'data') {
          const da = valorA ? new Date(valorA).getTime() : 0;
          const db = valorB ? new Date(valorB).getTime() : 0;
          return (da - db) * direction;
        }

        const numA = parseFloat(String(valorA).replace(/\D/g, ''));
        const numB = parseFloat(String(valorB).replace(/\D/g, ''));
        const ambosNumeros =
          !Number.isNaN(numA) && !Number.isNaN(numB) && String(valorA) !== '' && String(valorB) !== '';

        if (ambosNumeros) {
          return (numA - numB) * direction;
        }

        return String(valorA).localeCompare(String(valorB), 'pt-BR', { sensitivity: 'base' }) * direction;
      });

      const total = filtrada.length;
      const totalPages = Math.max(Math.ceil(total / limitNumber), 1);
      const safePage = Math.min(pageNumber, totalPages);
      const offset = (safePage - 1) * limitNumber;
      const rows = filtrada.slice(offset, offset + limitNumber).map((manutencao, index) => {
        const dataManutencao =
          manutencao.dataSaida && String(manutencao.dataSaida).trim() !== ''
            ? manutencao.dataSaida
            : manutencao.dataEntrada;

        return {
          ...manutencao,
          rowNumber: offset + index + 1,
          dataManutencao,
          local: manutencao.local || manutencao.setor || '-',
        };
      });

      return {
        rows,
        total,
        page: safePage,
        limit: limitNumber,
        totalPages,
      };
    } catch (error) {
      throw new Error(`Erro ao paginar manutenÃ§Ãµes: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const manutencao = await Manutencao.findByPk(id, {
        include: [
          {
            model: Computador,
            as: 'computador',
            include: [{ model: Empresa, as: 'empresa', attributes: ['nome'] }],
          },
        ],
      });

      return manutencao;
    } catch (error) {
      throw new Error('Erro ao buscar manutenções por ID: ' + error.message);
    }
  }

  async findByEmpresa(empresaId) {
    try {
      // const manutencoesList = await Manutencao.findAll({
      //   where: { empresaId: empresaId },
      //   include: "empresa",
      // });
      return;
    } catch (error) {
      throw new Error('Erro ao buscar manutenções by empresa: ' + error.message);
    }
  }

  async findByComputador(id) {
    try {
      const manutencaoList = await Manutencao.findAll({
        where: { computadorId: id },
        include: 'computador',
      });

      const manutencaoJSON = manutencaoList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
        computadorId: manutencao.dataValues.computadorId,
        pcName: manutencao.computador.patrimonio,
        setor: manutencao.computador.setor, // ✅
      }));
      return manutencaoJSON;
    } catch (error) {
      throw new Error('Erro ao buscar computadores: ' + error.message);
    }
  }

  async addItemManutencao(payload) {
    const {
      manutencaoId,
      descricao,
      tipo = null,
      materialId = null,
      quantidade = 1,
      specs_depois = null,

      materialRemovidoId = null,
      tipoRemovido = null,
      qtdRemovida = 1,
      destinoRemovida = null,
      motivoRemovida = null,
    } = payload;

    if (!manutencaoId) throw new Error('manutencaoId é obrigatório.');
    if (!descricao || !descricao.trim()) throw new Error('descricao é obrigatória.');

    // 1) Buscar manutenção -> computadorId
    const manutencao = await Manutencao.findByPk(manutencaoId);
    if (!manutencao) throw new Error('Manutenção não encontrada.');

    const computadorId = manutencao.computadorId;
    if (!computadorId) throw new Error('Manutenção sem computador vinculado.');

    // 2) Buscar computador e specs atuais
    const computador = await Computador.findByPk(computadorId);
    if (!computador) throw new Error('Computador não encontrado.');

    const specs_antes = computador.specs_override || computador.specs || null;
    const computadorEstruturado = String(computador.specs_modo || 'LEGADO').toUpperCase() === 'ESTRUTURADO';
    const procedimentoComPeca =
      tipo === 'TROCA_PECA' || tipo === 'REMOCAO_PECA' || tipo === 'ADICIONAR_PECA';
    const trocaDePeca = tipo === 'TROCA_PECA';
    const remocaoDePeca = tipo === 'REMOCAO_PECA';
    const adicaoDePeca = tipo === 'ADICIONAR_PECA';

    if (!computadorEstruturado) {
      throw new Error('Esta máquina ainda está em modo legado. Converta para estruturado antes de continuar a manutenção.');
    }

    // 3) Se NÃO for troca de peça, salva procedimento simples
    if (adicaoDePeca) {
      const qtdAdicao = Number(quantidade) || 1;
      if (!materialId) throw new Error('materialId é obrigatório para ADICIONAR_PECA.');
      if (qtdAdicao <= 0) throw new Error('Quantidade inválida.');

      return await database.transaction(async (t) => {
        const material = await Material.findByPk(materialId, { transaction: t });
        if (!material) throw new Error('Material não encontrado.');

        const categoriaInstalada = this.computadorEstruturadoService.inferCategoria(material);
        if (categoriaInstalada === 'OUTROS') {
          throw new Error(
            'Adicionar peca nesta tela aceita apenas componentes estruturados: Processador, Memoria, Armazenamento ou Fonte.'
          );
        }

        if (Number(material.quantidade_disponivel || 0) < qtdAdicao) {
          throw new Error(`Estoque insuficiente. Disponível: ${material.quantidade_disponivel}`);
        }

        const snapshot = [
          `Instalado: ${[
            material.tipo,
            material.material,
            material.marca ? `Marca: ${material.marca}` : null,
            material.especificacao ? `Spec: ${material.especificacao}` : null,
            material.nf ? `NF: ${material.nf}` : null,
            `Qtd: ${qtdAdicao}`,
          ]
            .filter(Boolean)
            .join(' | ')}`,
          'Procedimento: Adição de peça',
        ]
          .filter(Boolean)
          .join(' || ');

        const item = await ManutencaoItem.create(
          {
            manutencaoId,
            descricao: descricao.trim(),
            tipo: 'ADICIONAR_PECA',
            specs_antes,
            specs_depois: null,
            material_snapshot: snapshot,
          },
          { transaction: t }
        );

        await ManutencaoMaterial.create(
          {
            manutencaoItem_id: item.id,
            material_id: material.id,
            quantidade: qtdAdicao,
          },
          { transaction: t }
        );

        material.quantidade_disponivel = Number(material.quantidade_disponivel || 0) - qtdAdicao;
        material.quantidade_em_uso = Number(material.quantidade_em_uso || 0) + qtdAdicao;
        await material.save({ transaction: t });

        await MaterialMovimento.create(
          {
            material_id: material.id,
            tipo_movimento: 'SAIDA_MANUTENCAO',
            quantidade: qtdAdicao,
            referencia_manutencaoItem_id: item.id,
            referencia_computador_id: computadorId,
            observacao: 'Peça adicionada na manutenção',
          },
          { transaction: t }
        );

        const resultadoEstruturado =
          await this.computadorEstruturadoService.adicionarComponenteEstruturado({
            computadorId,
            materialInstaladoId: material.id,
            quantidadeInstalada: qtdAdicao,
            transaction: t,
          });

        item.specs_depois = resultadoEstruturado.specsText || specs_antes;
        await item.save({ transaction: t });

        return true;
      });
    }

    if (!procedimentoComPeca) {
      await ManutencaoItem.create({
        manutencaoId,
        descricao: descricao.trim(),
        tipo: tipo || null,
        specs_antes: null,
        specs_depois: null,
        material_snapshot: null,
      });

      return true;
    }

    // ========== TROCA / REMOÇÃO DE PEÇA (transação completa) ==========
    const qtd = Number(quantidade) || 1;
    const placeholderSelecionado =
      typeof materialRemovidoId === 'string' && materialRemovidoId.startsWith('placeholder:');
    const categoriaPlaceholder = placeholderSelecionado
      ? String(materialRemovidoId).split(':')[1] || ''
      : '';
    if (trocaDePeca) {
      if (!materialId) throw new Error('materialId é obrigatório para TROCA_PECA.');
      if (qtd <= 0) throw new Error('Quantidade inválida.');
    }
    if (!materialRemovidoId) {
      throw new Error('materialRemovidoId é obrigatório para movimentação de peça.');
    }
    const qtdRem = placeholderSelecionado ? 1 : (Number(qtdRemovida) || 1);
    if (remocaoDePeca && placeholderSelecionado) {
      throw new Error('RemoÃ§Ã£o sem troca exige um componente real vinculado Ã  mÃ¡quina.');
    }
    if (qtdRem <= 0) throw new Error('qtdRemovida inválida.');
    if (!computadorEstruturado) {
      throw new Error('Troca ou remoção de peça exige converter esta máquina para o modo estruturado antes de continuar.');
    }

    if (destinoRemovida !== 'RECUPERAR' && destinoRemovida !== 'DEFEITO') {
      throw new Error("destinoRemovida deve ser 'RECUPERAR' ou 'DEFEITO'.");
    }

    if (destinoRemovida === 'DEFEITO' && (!motivoRemovida || !String(motivoRemovida).trim())) {
      throw new Error('motivoRemovida é obrigatório quando destinoRemovida=DEFEITO.');
    }

    return await database.transaction(async (t) => {
      let specsDepoisFinal = specs_antes;
      let material = null;

      if (!computadorEstruturado && specs_depois) {
        specsDepoisFinal = String(specs_depois);
      }

      if (trocaDePeca) {
        material = await Material.findByPk(materialId, { transaction: t });
        if (!material) throw new Error('Material não encontrado.');

        if (Number(material.quantidade_disponivel || 0) < qtd) {
          throw new Error(`Estoque insuficiente. Disponível: ${material.quantidade_disponivel}`);
        }
      }

      const matRem = placeholderSelecionado
        ? {
            id: null,
            tipo:
              tipoRemovido ||
              this.computadorEstruturadoService.buildPlaceholderComponente(categoriaPlaceholder)?.tipo ||
              categoriaPlaceholder,
            material:
              this.computadorEstruturadoService.buildPlaceholderComponente(categoriaPlaceholder)?.material ||
              tipoRemovido ||
              categoriaPlaceholder,
            marca: null,
            especificacao: null,
            nf: null,
          }
        : await Material.findByPk(materialRemovidoId, { transaction: t });
      if (!matRem) throw new Error('Material removido não encontrado.');

      if (trocaDePeca) {
        const tipoInstalado = this.computadorEstruturadoService.inferCategoria(material);
        const tipoRemovido = placeholderSelecionado
          ? String(categoriaPlaceholder || '').trim().toUpperCase()
          : this.computadorEstruturadoService.inferCategoria(matRem);
        if (!tipoInstalado || !tipoRemovido || tipoInstalado !== tipoRemovido) {
          throw new Error(
            `A peça nova precisa ter o mesmo tipo da peça removida. Instalado: ${material.tipo || '-'} | Removido: ${matRem.tipo || '-'}.`
          );
        }
      }

      const quantidadeNoComputador = placeholderSelecionado
        ? qtdRem
        : await this.getQuantidadeEstruturadaNoComputador(
            computadorId,
            materialRemovidoId,
            t
          );

      if (quantidadeNoComputador < qtdRem) {
        throw new Error(
          `A máquina não possui esse componente em quantidade suficiente para remoção. Vinculado: ${quantidadeNoComputador}.`
        );
      }

      const detalhesRemocao = placeholderSelecionado
        ? `Slot vazio preservado: ${matRem.material}`
        : [
            matRem.tipo,
            matRem.material,
            matRem.marca ? `Marca: ${matRem.marca}` : null,
            matRem.especificacao ? `Spec: ${matRem.especificacao}` : null,
            matRem.nf ? `NF: ${matRem.nf}` : null,
            `Qtd: ${qtdRem}`,
          ]
            .filter(Boolean)
            .join(' | ');

      const snapshot = [
        trocaDePeca
          ? `Instalado: ${[
              material.tipo,
              material.material,
              material.marca ? `Marca: ${material.marca}` : null,
              material.especificacao ? `Spec: ${material.especificacao}` : null,
              material.nf ? `NF: ${material.nf}` : null,
              `Qtd: ${qtd}`,
            ]
              .filter(Boolean)
              .join(' | ')}`
          : 'Procedimento: Remoção de peça sem troca',
        `${remocaoDePeca ? 'Removido sem reposição' : 'Removido'}: ${detalhesRemocao}`,
        `Destino removida: ${destinoRemovida}`,
        destinoRemovida === 'DEFEITO' && motivoRemovida
          ? `Motivo: ${String(motivoRemovida).trim()}`
          : null,
      ]
        .filter(Boolean)
        .join(' || ');

      const item = await ManutencaoItem.create(
        {
          manutencaoId,
          descricao: descricao.trim(),
          tipo,
          specs_antes,
          specs_depois: specsDepoisFinal,
          material_snapshot: snapshot,
        },
        { transaction: t }
      );

      if (trocaDePeca) {
        await ManutencaoMaterial.create(
          {
            manutencaoItem_id: item.id,
            material_id: material.id,
            quantidade: qtd,
          },
          { transaction: t }
        );

        material.quantidade_disponivel = material.quantidade_disponivel - qtd;
        material.quantidade_em_uso = material.quantidade_em_uso + qtd;
        await material.save({ transaction: t });

        await MaterialMovimento.create(
          {
            material_id: material.id,
            tipo_movimento: 'SAIDA_MANUTENCAO',
            quantidade: qtd,
            referencia_manutencaoItem_id: item.id,
            referencia_computador_id: computadorId,
          },
          { transaction: t }
        );
      }

      if (!placeholderSelecionado && destinoRemovida === 'RECUPERAR') {
        await this.consumirEmUsoEstruturado(matRem, computadorId, qtdRem, t);
        if (remocaoDePeca) {
          await this.removerQuantidadeEstruturadaDoComputador(computadorId, matRem.id, qtdRem, t);
        }
        matRem.quantidade_disponivel = matRem.quantidade_disponivel + qtdRem;
        await matRem.save({ transaction: t });

        await MaterialMovimento.create(
          {
            material_id: matRem.id,
            tipo_movimento: 'ENTRADA_RECUPERACAO',
            quantidade: qtdRem,
            referencia_manutencaoItem_id: item.id,
            referencia_computador_id: computadorId,
            observacao: remocaoDePeca
              ? 'Peça removida sem troca e enviada para recuperação'
              : 'Peça removida recuperada na troca',
          },
          { transaction: t }
        );
      } else if (!placeholderSelecionado && destinoRemovida === 'DEFEITO') {
        await this.consumirEmUsoEstruturado(matRem, computadorId, qtdRem, t);
        if (remocaoDePeca) {
          await this.removerQuantidadeEstruturadaDoComputador(computadorId, matRem.id, qtdRem, t);
        }
        matRem.quantidade_baixada = (matRem.quantidade_baixada || 0) + qtdRem;
        await matRem.save({ transaction: t });

        await MaterialMovimento.create(
          {
            material_id: matRem.id,
            tipo_movimento: 'BAIXA',
            quantidade: qtdRem,
            referencia_manutencaoItem_id: item.id,
            referencia_computador_id: computadorId,
            observacao: String(motivoRemovida).trim(),
          },
          { transaction: t }
        );
      }

      if (computadorEstruturado && trocaDePeca) {
        const resultadoEstruturado = placeholderSelecionado
          ? await this.computadorEstruturadoService.instalarComponenteEstruturado({
              computadorId,
              materialInstaladoId: material.id,
              quantidadeInstalada: qtd,
              categoria: categoriaPlaceholder || tipoRemovido || material.tipo,
              transaction: t,
            })
          : await this.computadorEstruturadoService.substituirComponenteEstruturado({
              computadorId,
              materialInstaladoId: material.id,
              quantidadeInstalada: qtd,
              materialRemovidoId: matRem.id,
              quantidadeRemovida: qtdRem,
              transaction: t,
            });

        specsDepoisFinal = resultadoEstruturado.specsText || specsDepoisFinal;
        item.specs_depois = specsDepoisFinal;
        await item.save({ transaction: t });
      } else if (computadorEstruturado && remocaoDePeca) {
        const resultadoEstruturado = await this.computadorEstruturadoService.syncSpecsEstruturadasDoComputador(
          computadorId,
          t
        );
        specsDepoisFinal = resultadoEstruturado.specsText || null;
        item.specs_depois = specsDepoisFinal;
        await item.save({ transaction: t });
      } else if (specsDepoisFinal && specsDepoisFinal !== specs_antes) {
        computador.specs_override = specsDepoisFinal;
        await computador.save({ transaction: t });
      }

      return true;
    });
  }

  async getItemManutencao(id) {
    try {
      const manutencaoItemList = await ManutencaoItem.findAll({
        where: { manutencaoId: id },
        include: 'manutencao',
        order: [['createdAt', 'DESC']], // ✅ mais novos primeiro
      });

      const manutencaoJSON = manutencaoItemList.map((item) => ({
        id: item.dataValues.id,
        descricao: item.dataValues.descricao,
        tipo: item.dataValues.tipo,
        material_snapshot: item.dataValues.material_snapshot,
        specs_antes: item.dataValues.specs_antes,
        specs_depois: item.dataValues.specs_depois,
        dataEntrada: item.dataValues.createdAt,
      }));

      return manutencaoJSON;
    } catch (err) {
      throw new Error('Erro ao procurar os itens dentro de uma manutenção' + err);
    }
  }

  async encerrarManutencao(id) {
    try {
      const manutencao = await Manutencao.findByPk(id);
      manutencao.dataSaida = new Date();
      manutencao.save();

      return;
    } catch (err) {
      throw new Error('Erro ao encerrar uma manutenção' + err);
    }
  }
  async condenarMaquina(manutencaoId, motivo) {
    try {
      if (!manutencaoId) throw new Error('manutencaoId não informado.');
      if (!motivo || !motivo.trim()) throw new Error('Motivo é obrigatório.');

      const manutencao = await Manutencao.findByPk(manutencaoId);
      if (!manutencao) throw new Error('Manutenção não encontrada.');

      const pc = await Computador.findByPk(manutencao.computadorId);
      if (!pc) throw new Error('Computador não encontrado.');

      // ✅ irreversível: se já tem status, já foi condenado
      if (pc.status !== null) throw new Error('Este computador já está CONDENADO.');

      // 1) marca pc como condenado
      pc.status = manutencaoId; // ✅ guarda o ID da manutenção que condenou
      pc.ativo = false; // ✅ some da lista de ativos e da contagem
      pc.dataDescarte = new Date();
      pc.motivoDescarte = motivo.trim();
      await pc.save();

      // 2) fecha manutenção
      manutencao.dataSaida = new Date();
      await manutencao.save();

      // 3) (opcional, mas recomendo) salva o motivo também no histórico de procedimentos
      await ManutencaoItem.create({
        manutencaoId: manutencaoId,
        descricao: `⚠️ MÁQUINA CONDENADA — Motivo: ${motivo.trim()}`,
      });

      return;
    } catch (err) {
      throw new Error('Erro ao condenar máquina: ' + err.message);
    }
  }
  async condenarComRecuperacao(payload) {
    try {
      const { manutencaoId, motivoCondenacao, componentes = [] } = payload;

      if (!manutencaoId) throw new Error('manutencaoId não informado.');
      if (!motivoCondenacao || !String(motivoCondenacao).trim()) {
        throw new Error('Motivo da condenação é obrigatório.');
      }

      return await database.transaction(async (t) => {
        const manutencao = await Manutencao.findByPk(manutencaoId, { transaction: t });
        if (!manutencao) throw new Error('Manutenção não encontrada.');

        const pc = await Computador.findByPk(manutencao.computadorId, { transaction: t });
        if (!pc) throw new Error('Computador não encontrado.');

        if (pc.status !== null) {
          throw new Error('Este computador já está CONDENADO.');
        }

        const computadorEstruturado =
          String(pc.specs_modo || 'LEGADO').toUpperCase() === 'ESTRUTURADO';
        const itensResumo = [];
        let componentesProcessados = Array.isArray(componentes) ? [...componentes] : [];
        let componentesAtuais = [];
        let specsDepoisCondenacao = pc.specs_override || pc.specs || null;

        if (computadorEstruturado) {
          componentesAtuais = await this.getComponentesEstruturadosDoComputador(pc.id, null, t);

          if (!componentesProcessados.length) {
            componentesProcessados = componentesAtuais
              .map((comp) => ({
                materialId: Number(comp.id),
                quantidade: Number(comp.quantidade_no_computador || 0),
                destino: 'DEFEITO',
                motivo: String(motivoCondenacao).trim(),
              }))
              .filter((comp) => comp.materialId && comp.quantidade > 0);
          } else {
            const totaisSelecionados = componentesProcessados.reduce((acc, comp) => {
              const key = Number(comp.materialId);
              acc[key] = (acc[key] || 0) + Number(comp.quantidade || 0);
              return acc;
            }, {});

            componentesAtuais.forEach((comp) => {
              const materialId = Number(comp.id);
              const qtdAtual = Number(comp.quantidade_no_computador || 0);
              const qtdSelecionada = Number(totaisSelecionados[materialId] || 0);

              if (qtdSelecionada > qtdAtual) {
                throw new Error(
                  `A máquina não possui esse componente em quantidade suficiente. Vinculado: ${qtdAtual}.`
                );
              }

              const restante = qtdAtual - qtdSelecionada;
              if (restante > 0) {
                componentesProcessados.push({
                  materialId,
                  quantidade: restante,
                  destino: 'DEFEITO',
                  motivo: String(motivoCondenacao).trim(),
                });
              }
            });
          }
        }

        const itemCondenacao = await ManutencaoItem.create(
          {
            manutencaoId: manutencaoId,
            tipo: 'CONDENACAO',
            descricao: `⚠️ MÁQUINA CONDENADA — Motivo: ${String(motivoCondenacao).trim()}`,
            material_snapshot: '',
            specs_antes: pc.specs_override || pc.specs || null,
            specs_depois: pc.specs_override || pc.specs || null,
          },
          { transaction: t }
        );

        for (const comp of componentesProcessados) {
          const materialId = Number(comp.materialId);
          const qtd = Number(comp.quantidade || 0);
          const destino = String(comp.destino || '').trim();
          const motivo = String(comp.motivo || '').trim();

          if (!materialId) throw new Error('materialId inválido na recuperação.');
          if (!qtd || qtd <= 0) throw new Error('Quantidade inválida na recuperação.');
          if (destino !== 'RECUPERAR' && destino !== 'DEFEITO') {
            throw new Error('Destino inválido na recuperação.');
          }
          if (destino === 'DEFEITO' && !motivo) {
            throw new Error('Motivo é obrigatório para componentes com defeito.');
          }

          const mat = await Material.findByPk(materialId, { transaction: t });
          if (!mat) throw new Error('Material não encontrado na recuperação.');

          const quantidadeNoComputador = await this.getQuantidadeEstruturadaNoComputador(
            pc.id,
            materialId,
            t
          );

          if (quantidadeNoComputador < qtd) {
            throw new Error(
              `A máquina não possui esse componente em quantidade suficiente. Vinculado: ${quantidadeNoComputador}.`
            );
          }

          if (destino === 'RECUPERAR') {
            await this.consumirEmUsoEstruturado(mat, pc.id, qtd, t);
            await this.removerQuantidadeEstruturadaDoComputador(pc.id, materialId, qtd, t);
            mat.quantidade_disponivel = (mat.quantidade_disponivel || 0) + qtd;

            if ((mat.quantidade_em_uso || 0) < 0) {
              throw new Error(`Estoque inválido: EM USO negativo para ${mat.material}.`);
            }
            if ((mat.quantidade_disponivel || 0) < 0) {
              throw new Error(`Estoque inválido: DISPONÍVEL negativo para ${mat.material}.`);
            }
            if ((mat.quantidade_baixada || 0) < 0) {
              throw new Error(`Estoque inválido: BAIXADA negativo para ${mat.material}.`);
            }

            await mat.save({ transaction: t });

            await MaterialMovimento.create(
              {
                material_id: mat.id,
                tipo_movimento: 'ENTRADA_RECUPERACAO',
                quantidade: qtd,
                referencia_manutencaoItem_id: itemCondenacao.id,
                referencia_computador_id: pc.id,
                observacao: 'Recuperado na condenação da máquina',
              },
              { transaction: t }
            );

            itensResumo.push(
              `Recuperado: ${[
                mat.tipo,
                mat.material,
                mat.marca ? `Marca: ${mat.marca}` : null,
                mat.especificacao ? `Spec: ${mat.especificacao}` : null,
                `Qtd: ${qtd}`,
              ]
                .filter(Boolean)
                .join(' | ')}`
            );
          }

          if (destino === 'DEFEITO') {
            await this.consumirEmUsoEstruturado(mat, pc.id, qtd, t);
            await this.removerQuantidadeEstruturadaDoComputador(pc.id, materialId, qtd, t);
            mat.quantidade_baixada = (mat.quantidade_baixada || 0) + qtd;
            if ((mat.quantidade_em_uso || 0) < 0) {
              throw new Error(`Estoque inválido: EM USO negativo para ${mat.material}.`);
            }
            if ((mat.quantidade_disponivel || 0) < 0) {
              throw new Error(`Estoque inválido: DISPONÍVEL negativo para ${mat.material}.`);
            }
            if ((mat.quantidade_baixada || 0) < 0) {
              throw new Error(`Estoque inválido: BAIXADA negativo para ${mat.material}.`);
            }
            await mat.save({ transaction: t });

            await MaterialMovimento.create(
              {
                material_id: mat.id,
                tipo_movimento: 'BAIXA',
                quantidade: qtd,
                referencia_manutencaoItem_id: itemCondenacao.id,
                referencia_computador_id: pc.id,
                observacao: motivo,
              },
              { transaction: t }
            );

            itensResumo.push(
              `Defeito: ${[
                mat.tipo,
                mat.material,
                mat.marca ? `Marca: ${mat.marca}` : null,
                mat.especificacao ? `Spec: ${mat.especificacao}` : null,
                `Qtd: ${qtd}`,
                `Motivo: ${motivo}`,
              ]
                .filter(Boolean)
                .join(' | ')}`
            );
          }
        }
        itemCondenacao.material_snapshot = itensResumo.length
          ? itensResumo.join(' || ')
          : (
            computadorEstruturado
              ? 'Tudo condenado. Nenhum componente foi recuperado; todos os componentes estruturados vinculados foram baixados pelo motivo da condenacao.'
              : 'Maquina legado condenada sem movimentacao de componentes, pois os materiais nao estao estruturados no sistema.'
          );

        if (computadorEstruturado) {
          const resultadoEstruturado = await this.computadorEstruturadoService.syncSpecsEstruturadasDoComputador(
            pc.id,
            t
          );
          specsDepoisCondenacao = resultadoEstruturado.specsText || null;
        }

        itemCondenacao.specs_depois = specsDepoisCondenacao;
        await itemCondenacao.save({ transaction: t });

        pc.status = manutencaoId;
        pc.ativo = false;
        pc.dataDescarte = new Date();
        pc.motivoDescarte = String(motivoCondenacao).trim();
        await pc.save({ transaction: t });

        manutencao.dataSaida = new Date();
        await manutencao.save({ transaction: t });

        return true;
      });
    } catch (err) {
      throw new Error('Erro ao condenar com recuperação: ' + err.message);
    }
  }
}

module.exports = ManutencaoController;
