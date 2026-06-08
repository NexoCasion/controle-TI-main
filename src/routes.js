const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const router = Router();

//imports para lidar com upload de arquivos
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

// import controllers
const EmpresaController = require('./controllers/empresa');
const empresaController = new EmpresaController();
const ComputadorController = require('./controllers/computador');
const computadorController = new ComputadorController();
const ManutencaoController = require('./controllers/manutencao');
const manutencaoController = new ManutencaoController();
const TransferenciaController = require('./controllers/transferencia');
const transferenciaController = new TransferenciaController();
const MaterialController = require('./controllers/material');
const materialController = new MaterialController();
const DashboardController = require('./controllers/dashboard');
const dashboardController = new DashboardController();
const AuthController = require('./controllers/auth');
const authController = new AuthController();
const { ensureAuth, redirectIfAuthenticated } = require('./middlewares/auth');
const User = require('./models/User');
const { parseHwinfoCsv, parseComputerIdentityFromFilename } = require('./services/hwinfoCsvParser');

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
});

function consumeSessionValue(req, key) {
  const value = req.session?.[key];
  if (req.session && Object.prototype.hasOwnProperty.call(req.session, key)) {
    delete req.session[key];
  }
  return value || null;
}

async function getCurrentMaintenanceDescriptionTemplates(req) {
  const currentUser = req.session?.user?.id ? await User.findByPk(req.session.user.id) : null;
  const preferences = authController.normalizeHomeDashboardPreferences(
    currentUser?.home_dashboard_preferences,
    []
  );

  return preferences.maintenanceDescriptionTemplates || [];
}

async function processarImportacaoEstruturadaPorArquivo({ file, empresaId, fontePadrao = '' }) {
  const csvContent = fs.readFileSync(file.path, 'utf-8');
  const identidade = parseComputerIdentityFromFilename(file.originalname || file.filename);
  const parsed = parseHwinfoCsv(csvContent);
  const fonteFinal = String(fontePadrao || identidade.fonte || '').trim();

  if (!parsed.processador && !(parsed.memorias || []).length && !(parsed.armazenamentos || []).length) {
    throw new Error('CSV HWiNFO fora do padrao esperado para processador, memoria ou armazenamento.');
  }

  const resultado = await computadorController.criarEstruturadoPorCsv({
    patrimonio: identidade.patrimonio,
    setor: identidade.setor,
    empresaId,
    csvContent,
    fonte: fonteFinal,
  });

  return {
    resultado,
    identidade,
    fonteFinal,
  };
}

function buildStructuredSpecsView(computador = null) {
  if (!computador) return null;

  const modo = String(
    computador.specs_modo ||
      computador?.dataValues?.specs_modo ||
      'LEGADO'
  ).toUpperCase();

  if (modo !== 'ESTRUTURADO') return null;

  const rawStructured =
    computador.specs_estruturadas ||
    computador?.dataValues?.specs_estruturadas ||
    null;

  let parsed = {};
  if (rawStructured) {
    try {
      parsed =
        typeof rawStructured === 'string'
          ? JSON.parse(rawStructured)
          : rawStructured;
    } catch (error) {
      parsed = {};
    }
  }

  const toItemText = (item) => {
    if (!item) return null;

    const parts = [item.material, item.especificacao]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    if (!parts.length) return null;

    const label = parts.join(' - ');
    const quantidade = Number(item.quantidade || 1);
    return quantidade > 1 ? `${label} (${quantidade}x)` : label;
  };

  const sections = [];
  const modelo = String(parsed.marcaComputador || parsed.nomeComputador || '').trim();

  if (modelo) {
    sections.push({
      title: 'Modelo',
      items: [modelo],
    });
  }

  if (parsed.processador) {
    const processadorText = toItemText(parsed.processador);
    if (processadorText) {
      sections.push({
        title: 'Processador',
        items: [processadorText],
      });
    }
  }

  const memorias = Array.isArray(parsed.memorias)
    ? parsed.memorias.map(toItemText).filter(Boolean)
    : [];
  if (memorias.length) {
    sections.push({
      title: 'Memória',
      items: memorias,
    });
  }

  const armazenamentos = Array.isArray(parsed.armazenamentos)
    ? parsed.armazenamentos.map(toItemText).filter(Boolean)
    : [];
  if (armazenamentos.length) {
    sections.push({
      title: 'Armazenamento',
      items: armazenamentos,
    });
  }

  const fontes = Array.isArray(parsed.fontes)
    ? parsed.fontes.map(toItemText).filter(Boolean)
    : [];
  if (fontes.length) {
    sections.push({
      title: 'Fonte',
      items: fontes,
    });
  }

  if (!sections.length) return null;

  return {
    sections,
    resumo: {
      memorias: memorias.length,
      armazenamentos: armazenamentos.length,
      fontes: fontes.length,
    },
  };
}

router.get('/login', redirectIfAuthenticated, (req, res) => authController.renderLogin(req, res));

router.post('/login', loginRateLimit, redirectIfAuthenticated, async (req, res) => {
  return authController.login(req, res);
});

router.post('/logout', ensureAuth, async (req, res) => {
  return authController.logout(req, res);
});

router.use(ensureAuth);

router.get('/perfil', async (req, res) => {
  return authController.perfil(req, res);
});

router.post('/perfil/usuarios', async (req, res) => {
  try {
    await authController.createUser(req, res);
    return res.redirect('/perfil?success=Usuario cadastrado com sucesso.');
  } catch (error) {
    console.error('Erro ao cadastrar usuario:', error);
    return res.redirect(`/perfil?error=${encodeURIComponent(error.message)}`);
  }
});

router.post('/perfil/usuarios/:id', async (req, res) => {
  try {
    await authController.updateUser(req, res);
    return res.redirect('/perfil?success=Usuario atualizado com sucesso.');
  } catch (error) {
    console.error('Erro ao atualizar usuario:', error);
    return res.redirect(`/perfil?error=${encodeURIComponent(error.message)}`);
  }
});

router.post('/perfil/preferencias', async (req, res) => {
  try {
    await authController.updatePreferences(req, res);
    return res.redirect('/perfil?success=Preferencias atualizadas com sucesso.');
  } catch (error) {
    console.error('Erro ao atualizar preferencias do usuario:', error);
    return res.redirect(`/perfil?error=${encodeURIComponent(error.message)}`);
  }
});

router.post('/perfil/preferencias/home-dashboard', async (req, res) => {
  try {
    await authController.updateHomeDashboardPreferences(req, res);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar preferencias da home:', error);
    return res.status(400).json({ ok: false, error: error.message });
  }
});

router.get('/home', (req, res) => {
  return res.redirect('/');
});

router.get('/', async (req, res) => {
  try {
    const currentUser = req.session?.user?.id ? await User.findByPk(req.session.user.id) : null;
    const dashboard = await dashboardController.getHomeData(
      currentUser?.home_dashboard_preferences
    );
    const homeDashboardPreferences = authController.normalizeHomeDashboardPreferences(
      currentUser?.home_dashboard_preferences,
      dashboard.empresasFiltro
    );

    res.render('pages/home.ejs', {
      ...dashboard,
      homeDashboardPreferences,
    });
  } catch (error) {
    console.error('Erro ao carregar home:', error);
    res.status(500).send('Erro ao carregar home: ' + error.message);
  }
});

///EMPRESA///
router.get('/register-empresa', (req, res) => {
  res.render('pages/register_empresa.ejs');
});

router.post('/register-empresa', async (req, res) => {
  try {
    const { nome, sigla, descricao } = req.body;
    const empresa = await empresaController.create(nome, sigla, descricao);
    res.redirect('/empresas');
  } catch (error) {
    console.error('Erro ao registrar empresa:', error);
    res.status(500).send('Erro ao registrar empresa: ' + error.message);
  }
});

router.post('/editar-empresa', async (req, res) => {
  try {
    const { id, nome, sigla, descricao } = req.body;
    await empresaController.update(id, nome, sigla, descricao);
    res.redirect('/empresas');
  } catch (error) {
    console.error('Erro ao editar empresa:', error);
    res.status(500).send('Erro ao editar empresa: ' + error.message);
  }
});

router.post('/empresas/ordem', async (req, res) => {
  try {
    await empresaController.saveDisplayOrder(req.body.orderedIds);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar ordenacao das empresas:', error);
    return res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/empresas/:id/ordem', async (req, res) => {
  try {
    await empresaController.moveDisplayOrder(req.params.id, req.body.direction);
    res.redirect('/empresas');
  } catch (error) {
    console.error('Erro ao reordenar empresa:', error);
    res.status(500).send('Erro ao reordenar empresa: ' + error.message);
  }
});

router.get('/empresas', async (req, res) => {
  const empresaController = new EmpresaController();
  const empresasList = await empresaController.getAll();

  res.render('pages/empresas', { empresas: empresasList });
});

router.get('/get-empresas', async (req, res) => {
  const empresasList = await empresaController.getAll();

  res.json(empresasList);
});

/// COMPUTADORES ///
router.get('/editar-pc', async (req, res) => {
  const { id } = req.query;
  const computador = await computadorController.getById(id);
  const { patrimonio, specs, specs_override, specs_modo, empresa, setor, anydesk } = computador;
  const empresas = await empresaController.getAll();
  return res.render('pages/editar-pc', {
    specs: specs_override || specs,
    specsModo: specs_modo || 'LEGADO',
    patrimonio,
    id,
    empresas,
    empresa,
    setor,
    anydesk,
    structuredSpecsView: buildStructuredSpecsView(computador),
  });
});

router.post('/editar-pc', async (req, res) => {
  const { id } = req.query;
  const { patrimonio, specs, setor, anydesk } = req.body;
  const computador = await computadorController.update({ id, patrimonio, specs, setor, anydesk });
  return res.redirect(`/ver-pc?id=${id}`);
});
router.get('/computadores-by-empresa', async (req, res) => {
  const {
    empresaId,
    status = 'ativos',
    q = '',
    page = 1,
    limit = 20,
    sortBy = 'patrimonio',
    sortDir = 'ASC',
  } = req.query;

  const resultado = await computadorController.getPaged({
    empresaId,
    status,
    q,
    page: Number(page),
    limit,
    sortBy,
    sortDir,
  });

  return res.json(resultado);
});

router.get('/computadores', async (req, res) => {
  const computadoresList = await computadorController.getAll();
  const empresasList = await empresaController.getAll();
  const importCsvBatchResult = consumeSessionValue(req, 'importCsvBatchResult');
  const currentUser = req.session?.user?.id ? await User.findByPk(req.session.user.id) : null;
  const maintenanceDescriptionTemplates = await getCurrentMaintenanceDescriptionTemplates(req);
  const addComputerDefaultModal = authController.normalizeAddComputerDefaultModal(
    currentUser?.add_computer_default_modal || req.session?.user?.addComputerDefaultModal
  );

  res.render('pages/computadores', {
    computadores: computadoresList,
    empresas: empresasList,
    importCsvBatchResult,
    addComputerDefaultModal,
    maintenanceDescriptionTemplates,
  });
});

router.get('/register-pc', async (req, res) => {
  const empresasList = await empresaController.getAll();

  res.render('pages/register_computer', { empresas: empresasList });
});

router.post('/register-pc', async (req, res) => {
  const { patrimonio, specs, empresaId, setor } = req.body; // Adicionar o campo local aqui
  try {
    const pc = await computadorController.create(patrimonio, specs, empresaId, setor); // E aqui
    res.locals.alert = `Computador cadastrado com ID: ${pc.id}`;
    res.redirect(`/ver-pc?id=${pc.id}`);
  } catch (error) {
    console.error('Erro ao registrar pc:', error);
    res.status(500).send('Erro ao registrar pc');
  }
});

router.get('/ver-pc', async (req, res) => {
  try {
    const { id } = req.query;

    const pc = await computadorController.getById(id);
    const empresasList = await empresaController.getAll(); // <-- necessário pro modal de transferir

    return res.render('pages/computador', {
      alert: res.locals.alert,
      computador: pc,
      empresas: empresasList,
      maintenanceDescriptionTemplates: await getCurrentMaintenanceDescriptionTemplates(req),
      structuredSpecsView: buildStructuredSpecsView(pc),
    });
  } catch (error) {
    console.error('Erro ao procurar pc:', error);
    res.status(500).send('Erro ao procurar pc' + error);
  }
});

router.post('/descartar-pc', async (req, res) => {
  try {
    const { id, motivo } = req.body;
    await computadorController.descartar(id, motivo);
    return res.redirect('/computadores');
  } catch (error) {
    console.error('Erro ao descartar pc:', error);
    return res.status(500).send('Erro ao descartar pc: ' + error.message);
  }
});

router.post('/reativar-pc', async (req, res) => {
  try {
    const { id } = req.body;
    await computadorController.reativar(id);
    return res.redirect('/computadores');
  } catch (error) {
    console.error('Erro ao reativar pc:', error);
    return res.status(500).send('Erro ao reativar pc: ' + error.message);
  }
});

//MANUTENCOES
router.get('/manutencoes-by-empresa', async (req, res) => {
  const { empresaId } = req.query;
  const manutencoesList = await manutencaoController.findByEmpresa(empresaId);

  return res.json(manutencoesList);
});

router.get('/manutencoes-by-computador', async (req, res) => {
  const { id } = req.query; //////CHAAANGE
  const manutencoesList = await manutencaoController.findByComputador(id);
  const transferenciasList = await transferenciaController.findByComputador(id);

  const historico = [
    ...(manutencoesList || []).map((manutencao) => ({
      ...manutencao,
      tipo: 'MANUTENCAO',
      dataReferencia: manutencao.dataEntrada,
      dataFim: manutencao.dataSaida,
    })),
    ...(transferenciasList || []),
  ].sort((a, b) => new Date(b.dataReferencia) - new Date(a.dataReferencia));

  return res.json(historico);
});

router.get('/manutencoes', async (req, res) => {
  const manutencaoList = await manutencaoController.findAll();
  const empresasList = await empresaController.getAll();
  const maintenanceDescriptionTemplates = await getCurrentMaintenanceDescriptionTemplates(req);

  return res.render('pages/manutencoes', {
    empresas: empresasList,
    manutencoes: manutencaoList,
    maintenanceDescriptionTemplates,
  });
});

router.get('/manutencoes-data', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      q = '',
      empresa = 'todas',
      status = 'todas_sem_condenados',
      dataInicio = '',
      dataFim = '',
      sortBy = 'id',
      sortDir = 'ASC',
    } = req.query;

    const resultado = await manutencaoController.getPaged({
      page: Number(page),
      limit: Number(limit),
      q,
      empresa,
      status,
      dataInicio,
      dataFim,
      sortBy,
      sortDir,
    });

    return res.json(resultado);
  } catch (err) {
    console.error('Erro ao paginar manutencoes:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/manutencoes-open', async (req, res) => {
  const manutencaoList = await manutencaoController.findOpened();

  return res.json(manutencaoList);
});

router.get('/register-manutencao', async (req, res) => {
  const computadoresList = await computadorController.getAll();
  const maintenanceDescriptionTemplates = await getCurrentMaintenanceDescriptionTemplates(req);

  return res.render('pages/register_manutencao', {
    computadores: computadoresList,
    maintenanceDescriptionTemplates,
  });
});

router.post('/register-manutencao', async (req, res) => {
  const { descricao, computadorId } = req.body;

  try {
    const manutencao = await manutencaoController.create(descricao, computadorId);
    return res.redirect(`/ver-manutencao?id=${manutencao.id}`);
  } catch (error) {
    console.error('Erro ao registrar manutencao:', error);
    return res.status(500).send('Erro ao registrar manutencao: ' + error.message);
  }
});

router.get('/ver-manutencao', async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).send('ID da manutenção não informado.');
    }

    const manutencao = await manutencaoController.findById(id);
    if (!manutencao) {
      return res.status(404).send('Manutenção não encontrada.');
    }

    const manutencoes = await manutencaoController.getItemManutencao(id);

    return res.render('pages/manutencao', {
      manutencao,
      manutencoes,
      structuredSpecsView: buildStructuredSpecsView(manutencao.computador),
    });
  } catch (err) {
    console.error('Erro ao abrir manutenção:', err);
    return res.status(500).send('Erro ao abrir manutenção: ' + err.message);
  }
});

router.get('/computadores/:id/componentes-estruturados', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, includePlaceholders } = req.query;
    const componentes = await manutencaoController.getComponentesEstruturadosDoComputador(
      Number(id),
      tipo,
      null,
      {
        includePlaceholders:
          String(includePlaceholders) === '1' ||
          String(includePlaceholders).toLowerCase() === 'true',
      }
    );
    return res.json(componentes);
  } catch (err) {
    console.error('Erro ao buscar componentes estruturados do computador:', err);
    return res.status(400).json({ error: err.message });
  }
});

router.post('/add-item-manutencao', async (req, res) => {
  try {
    const {
      manutencaoId,
      descricao,

      // novos campos do procedimento
      tipo, // 'TROCA_PECA' | 'LIMPEZA' | 'MANUT_SIMPLES'
      materialId, // somente se TROCA_PECA
      quantidade, // somente se TROCA_PECA
      specs_depois, // string editada (somente se TROCA_PECA)
      //peça removida
      materialRemovidoId, // somente se TROCA_PECA e tiver peça removida
      qtdRemovida, // somente se TROCA_PECA e tiver peça removida
      destinoRemovida, // 'DESCARTE' ou 'ESTOQUE' (somente se TROCA_PECA e tiver peça removida)
      motivoRemovida, // string editada (somente se TROCA_PECA e tiver peça removida)
    } = req.body;

    await manutencaoController.addItemManutencao({
      manutencaoId: Number(manutencaoId),
      descricao,
      tipo: tipo || null,

      // peça nova
      materialId: materialId ? Number(materialId) : null,
      quantidade: quantidade ? Number(quantidade) : 1,
      specs_depois: specs_depois || null,

      // peça removida
      materialRemovidoId:
        String(materialRemovidoId || '').trim().startsWith('placeholder:')
          ? String(materialRemovidoId || '').trim()
          : (materialRemovidoId ? Number(materialRemovidoId) : null),
      qtdRemovida: qtdRemovida ? Number(qtdRemovida) : 1,
      destinoRemovida: destinoRemovida || null,
      motivoRemovida: motivoRemovida || null,
    });

    // ✅ Se você usa formulário normal (sem fetch), redireciona:
    // Ajuste o redirect para sua rota/tela de manutenção se precisar.
    // Exemplo comum:
    // return res.redirect(`/manutencao/${manutencaoId}`);
    //
    // Por enquanto, vou devolver JSON (funciona pra fetch).
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao adicionar procedimento:', err);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/get-itens-manutencao', async (req, res) => {
  try {
    const { id } = req.query;
    const manutencaoItensList = await manutencaoController.getItemManutencao(Number(id));
    return res.json(manutencaoItensList);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/encerrar-manutencao', async (req, res) => {
  return res.status(405).send('Use POST para encerrar manutenção.');
});

router.post('/encerrar-manutencao', async (req, res) => {
  const id = Number(req.body.id || req.query.id);

  if (!id) {
    return res.status(400).send('ID da manutenção não informado.');
  }

  await manutencaoController.encerrarManutencao(id);

  const referer = req.headers.referer || `/ver-manutencao?id=${id}`;
  return res.redirect(referer);
});
// CONDENAR MÁQUINA (irreversível)
router.post('/condenar-pc', async (req, res) => {
  try {
    const { manutencaoId, motivo } = req.body;

    if (!manutencaoId) return res.status(400).send('manutencaoId não informado');
    if (!motivo || !motivo.trim()) return res.status(400).send('Motivo não informado');

    await manutencaoController.condenarPc(Number(manutencaoId), motivo.trim());

    return res.redirect(`/ver-manutencao?id=${manutencaoId}`);
  } catch (err) {
    console.error('Erro ao condenar PC:', err);
    return res.status(500).send('Erro ao condenar PC: ' + err.message);
  }
});

router.post('/condenar-maquina', async (req, res) => {
  try {
    const { manutencaoId, motivo } = req.body;

    await manutencaoController.condenarMaquina(manutencaoId, motivo);

    return res.redirect(`/ver-manutencao?id=${manutencaoId}`);
  } catch (err) {
    console.error('Erro ao condenar máquina:', err);
    return res.status(500).send('Erro ao condenar máquina: ' + err.message);
  }
});
router.post('/condenar-maquina-com-recuperacao', async (req, res) => {
  try {
    const { manutencaoId, motivoCondenacao, componentes } = req.body;

    await manutencaoController.condenarComRecuperacao({
      manutencaoId: Number(manutencaoId),
      motivoCondenacao,
      componentes,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao condenar com recuperação:', err);
    return res.status(400).json({ error: err.message });
  }
});
//TRANSFERENCIAS
router.get('/transferir', async (req, res) => {
  return res.status(405).send('Use POST para registrar transferência.');
});

router.post('/transferir', async (req, res) => {
  const { computador, emp_origem, emp_destino, observacao } = req.body;

  try {
    const transferencia = await transferenciaController.create(
      computador,
      emp_origem,
      emp_destino,
      observacao
    );
    return res.redirect(`/ver-pc?id=${computador}`);
  } catch (error) {
    console.error('Erro ao registrar transferencia:', error);
    res.status(500).send('Erro ao registrar transferencia' + error.message);
  }
});

/// IMPORTAR CSV ///
// IMPORTAR CSV (TELA)
router.get('/importar-csv', async (req, res) => {
  const empresasList = await empresaController.getAll();
  return res.render('pages/importacao', { empresas: empresasList });
});

router.post('/importar-csv', upload.single('csvFile'), async (req, res) => {
  let filePath = null;
  try {
    const { empresaId, fonte } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).send('Nenhum arquivo enviado.');
    }

    filePath = file.path;
    const { resultado } = await processarImportacaoEstruturadaPorArquivo({
      file,
      empresaId,
      fontePadrao: fonte,
    });

    return res.redirect(`/ver-pc?id=${resultado.computador.id}`);
  } catch (error) {
    console.error('Erro ao importar CSV estruturado:', error);
    return res.status(500).send('Erro ao importar CSV: ' + error.message);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

router.post('/importar-csv-lote', upload.array('csvFiles', 500), async (req, res) => {
  const files = (Array.isArray(req.files) ? req.files : []).filter((file) =>
    String(file?.originalname || file?.filename || '').toLowerCase().endsWith('.csv')
  );
  const { empresaId, fonte } = req.body;
  const resultado = {
    totalArquivos: files.length,
    importados: 0,
    falhas: 0,
    detalhes: [],
  };

  try {
    if (!empresaId) {
      throw new Error('Empresa obrigatoria para importacao em lote.');
    }

    if (!files.length) {
      throw new Error('Nenhum CSV foi enviado para o lote.');
    }

    for (const file of files) {
      const nomeArquivo = file.originalname || file.filename || 'arquivo.csv';

      try {
        const { resultado: importado, identidade } = await processarImportacaoEstruturadaPorArquivo({
          file,
          empresaId,
          fontePadrao: fonte,
        });

        resultado.importados += 1;
        resultado.detalhes.push({
          arquivo: nomeArquivo,
          patrimonio: identidade.patrimonio,
          status: 'IMPORTADO',
          computadorId: importado.computador?.id || null,
          mensagem: 'Importado com sucesso.',
        });
      } catch (error) {
        resultado.falhas += 1;
        resultado.detalhes.push({
          arquivo: nomeArquivo,
          patrimonio: null,
          status: 'ERRO',
          computadorId: null,
          mensagem: error.message,
        });
      } finally {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    req.session.importCsvBatchResult = resultado;
    return res.redirect('/computadores');
  } catch (error) {
    console.error('Erro ao importar lote de CSVs:', error);

    files.forEach((file) => {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    req.session.importCsvBatchResult = {
      totalArquivos: files.length,
      importados: 0,
      falhas: files.length,
      detalhes: [
        {
          arquivo: '-',
          patrimonio: null,
          status: 'ERRO',
          computadorId: null,
          mensagem: error.message,
        },
      ],
    };
    return res.redirect('/computadores');
  }
});

router.post('/computadores/estruturado-manual', async (req, res) => {
  try {
    const resultado = await computadorController.criarEstruturadoManual(req.body);
    return res.redirect(`/ver-pc?id=${resultado.computador.id}`);
  } catch (error) {
    console.error('Erro ao registrar computador estruturado manual:', error);
    return res.status(500).send('Erro ao registrar computador estruturado manual: ' + error.message);
  }
});

router.post('/computadores/:id/estruturado-manual', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await computadorController.estruturarManualExistente(Number(id), req.body);
    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao estruturar computador existente manualmente:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/computadores/:id/importar-hwinfo-csv', upload.single('csvFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { csvPath, fonte } = req.body;
    const { parseComputerIdentityFromFilename } = require('./services/hwinfoCsvParser');

    let resultado;

    if (req.file?.path) {
      const csvContent = fs.readFileSync(req.file.path, 'utf-8');
      const identidade = parseComputerIdentityFromFilename(req.file.originalname || req.file.filename);
      const fonteFinal = String(fonte || identidade.fonte || '').trim();
      resultado = await computadorController.importarHwinfoCsv(Number(id), csvContent, { fonte: fonteFinal });
      fs.unlinkSync(req.file.path);
    } else if (csvPath) {
      const identidade = parseComputerIdentityFromFilename(csvPath);
      const fonteFinal = String(fonte || identidade.fonte || '').trim();
      resultado = await computadorController.importarHwinfoCsvDeArquivo(Number(id), csvPath, { fonte: fonteFinal });
    } else {
      return res.status(400).json({ error: 'Envie csvFile ou csvPath.' });
    }

    return res.json(resultado);
  } catch (error) {
    console.error('Erro ao importar HWiNFO CSV:', error);
    return res.status(400).json({ error: error.message });
  }
});
/// MATERIAIS ///
router.get('/materiais-page', async (req, res) => {
  try {
    return res.render('pages/materiais');
  } catch (err) {
    console.error('Erro ao abrir página de materiais:', err);
    return res.status(500).send('Erro ao abrir página de materiais');
  }
});

router.get('/materiais/:id/uso-por-maquina', async (req, res) => {
  try {
    const MaterialController = require('./controllers/material');
    const ctrl = new MaterialController();
    const data = await ctrl.usoPorMaquina(req.params.id);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro ao buscar uso por máquina' });
  }
});
router.post('/materiais/recuperar', async (req, res) => {
  try {
    const ok = await materialController.recuperar(req.body);

    return res.json({ ok: !!ok });
  } catch (err) {
    console.error('Erro ao recuperar material:', err);

    return res.status(400).json({ error: err.message });
  }
});
// Listar materiais (com filtros opcionais):
// /materiais?tipo=Fonte&somenteDisponivel=1&q=razer
router.get('/materiais', async (req, res) => {
  try {
    const { tipo, somenteDisponivel, q } = req.query;

    const list = await materialController.getAll({
      tipo,
      somenteDisponivel:
        String(somenteDisponivel) === '1' || String(somenteDisponivel).toLowerCase() === 'true',
      q,
    });

    return res.json(list);
  } catch (err) {
    console.error('Erro ao listar materiais:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/materiais-data', async (req, res) => {
  try {
      const {
        tipo,
        somenteDisponivel,
        q,
        page = 1,
        limit = 20,
        sortBy,
        sortDir,
      } = req.query;

    const resultado = await materialController.getPaged({
      tipo,
      somenteDisponivel:
        String(somenteDisponivel) === '1' || String(somenteDisponivel).toLowerCase() === 'true',
        q,
        page: Number(page),
        limit: Number(limit),
        sortBy,
        sortDir,
      });

    return res.json(resultado);
  } catch (err) {
    console.error('Erro ao paginar materiais:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Tipos distintos (pra select)
router.get('/materiais-tipos', async (req, res) => {
  try {
    const tipos = await materialController.getTipos();
    return res.json(tipos);
  } catch (err) {
    console.error('Erro ao buscar tipos:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Criar material
router.post('/materiais', async (req, res) => {
  try {
    const created = await materialController.create(req.body);
    return res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    console.error('Erro ao criar material:', err);
    return res.status(400).json({ error: err.message });
  }
});

// Editar material
router.put('/materiais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await materialController.update(Number(id), req.body);
    return res.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error('Erro ao atualizar material:', err);
    return res.status(400).json({ error: err.message });
  }
});
router.post('/materiais/baixar', async (req, res) => {
  try {
    const ok = await materialController.baixar(req.body);
    return res.json({ ok: !!ok });
  } catch (err) {
    console.error('Erro ao baixar material:', err);
    return res.status(400).json({ error: err.message });
  }
});
// Movimentos (log)
router.get('/materiais/:id/movimentos', async (req, res) => {
  try {
    const { id } = req.params;
    const movs = await materialController.getMovimentos(Number(id));
    return res.json(movs);
  } catch (err) {
    console.error('Erro ao buscar movimentos:', err);
    return res.status(400).json({ error: err.message });
  }
});
router.get('/materiais/:id/baixados', async (req, res) => {
  try {
    const { id } = req.params;
    const baixados = await materialController.getBaixados(Number(id));
    return res.json(baixados);
  } catch (err) {
    console.error('Erro ao buscar itens baixados:', err);
    return res.status(400).json({ error: err.message });
  }
});
router.get('/materiais/:id/recuperados', async (req, res) => {
  try {
    const { id } = req.params;
    const recuperados = await materialController.getRecuperados(Number(id));
    return res.json(recuperados);
  } catch (err) {
    console.error('Erro ao buscar itens recuperados:', err);
    return res.status(400).json({ error: err.message });
  }
});
module.exports = router;
