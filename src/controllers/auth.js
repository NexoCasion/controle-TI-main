const bcrypt = require('bcrypt');
const { Op, fn, col, where } = require('sequelize');
const User = require('../models/User');
const Empresa = require('../models/Empresa');
const EmpresaController = require('./empresa');

const ROLES_PERMITIDOS = ['admin', 'tecnico'];
const ADD_COMPUTER_DEFAULT_MODALS = ['structured', 'single', 'batch'];
<<<<<<< Updated upstream
const HOME_DASHBOARD_CHART_IDS = ['ranking', 'maquinas', 'materiais'];
=======
const HOME_DASHBOARD_CHART_IDS = ['ranking', 'maquinas', 'materiais', 'backups'];
const HOME_RANKING_IGNORED_TERM_LIMIT = 30;
const MAINTENANCE_DESCRIPTION_TEMPLATE_LIMIT = 30;
const DEFAULT_MAINTENANCE_DESCRIPTION_TEMPLATES = [
  'Limpeza preventiva',
  'Erro de funcionamento',
  'Lentidao ou travamento',
  'Maquina sem ligar',
  'Formatacao ou reinstalacao do sistema',
  'Sem acesso a rede ou internet',
];
>>>>>>> Stashed changes

class AuthController {
  renderLogin(req, res) {
    return res.render('pages/login', {
      error: null,
      login: '',
    });
  }

  async login(req, res) {
    const login = String(req.body.login || req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.password || '');

    if (!login || !senha) {
      return res.status(400).render('pages/login', {
        error: 'Informe login e senha.',
        login,
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.like]: login } },
          { nome: { [Op.like]: login } },
        ],
        ativo: true,
      },
    });

    if (!user) {
      return res.status(401).render('pages/login', {
        error: 'Login invalido.',
        login,
      });
    }

    const senhaOk = await bcrypt.compare(senha, user.password_hash);
    if (!senhaOk) {
      return res.status(401).render('pages/login', {
        error: 'Login invalido.',
        login,
      });
    }

    req.session.user = {
      id: user.id,
      nome: user.nome,
      role: user.role,
      addComputerDefaultModal: this.normalizeAddComputerDefaultModal(user.add_computer_default_modal),
    };

    const returnTo = String(req.session.returnTo || '').trim();
    const redirectTo = returnTo && returnTo !== '/home' && returnTo.startsWith('/') ? returnTo : '/';
    delete req.session.returnTo;

    return res.redirect(redirectTo);
  }

  async logout(req, res) {
    return req.session.destroy(() => {
      res.clearCookie('controle_ti.sid');
      return res.redirect('/login');
    });
  }

  async perfil(req, res) {
    const userId = req.session?.user?.id;
    const user = userId ? await User.findByPk(userId) : null;
    const empresasFiltro = await this.getEmpresasFiltro();
    const isAdmin = req.session?.user?.role === 'admin';
    const users = isAdmin
      ? await User.findAll({
          order: [
            ['ativo', 'DESC'],
            ['nome', 'ASC'],
          ],
        })
      : [];

    return res.render('pages/perfil', {
      user,
      users,
      empresasFiltro,
      homeDashboardPreferences: this.normalizeHomeDashboardPreferences(
        user?.home_dashboard_preferences,
        empresasFiltro
      ),
      isAdmin,
      error: String(req.query.error || '').trim(),
      success: String(req.query.success || '').trim(),
    });
  }

  async createUser(req, res) {
    this.ensureAdmin(req);

    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = this.normalizeRole(req.body.role);
    const ativo = String(req.body.ativo || '1') !== '0';

    if (!nome || !email || !password) {
      throw new Error('Preencha nome, email e senha do novo usuario.');
    }

    if (password.length < 6) {
      throw new Error('A senha inicial precisa ter pelo menos 6 caracteres.');
    }

    await this.ensureUniqueUserFields({ nome, email });

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      nome,
      email,
      password_hash: passwordHash,
      role,
      add_computer_default_modal: 'structured',
      home_dashboard_preferences: null,
      ativo,
    });
  }

  async updateUser(req, res) {
    this.ensureAdmin(req);

    const id = Number(req.params.id);
    if (!id) {
      throw new Error('ID do usuario nao informado.');
    }

    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario nao encontrado.');
    }

    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = this.normalizeRole(req.body.role);
    const ativo = String(req.body.ativo || '1') !== '0';

    if (!nome || !email) {
      throw new Error('Nome e email sao obrigatorios.');
    }

    if (!ativo && Number(req.session?.user?.id) === Number(user.id)) {
      throw new Error('Nao e permitido desativar o usuario logado.');
    }

    await this.ensureUniqueUserFields({ nome, email, excludeId: user.id });

    user.nome = nome;
    user.email = email;
    user.role = role;
    user.ativo = ativo;

    if (password) {
      if (password.length < 6) {
        throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
      }
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();

    if (Number(req.session?.user?.id) === Number(user.id)) {
      req.session.user.nome = user.nome;
      req.session.user.role = user.role;
      req.session.user.addComputerDefaultModal = this.normalizeAddComputerDefaultModal(
        user.add_computer_default_modal
      );
    }
  }

  async updatePreferences(req, res) {
    const userId = Number(req.session?.user?.id);
    if (!userId) {
      throw new Error('Usuario logado nao encontrado.');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario nao encontrado.');
    }

    const empresasFiltro = await this.getEmpresasFiltro();
    user.add_computer_default_modal = this.normalizeAddComputerDefaultModal(
      req.body.addComputerDefaultModal
    );
    user.home_dashboard_preferences = this.serializeHomeDashboardPreferences(
      this.extractHomeDashboardPreferences(req.body),
      empresasFiltro
    );

    await user.save();

    if (req.session?.user) {
      req.session.user.addComputerDefaultModal = user.add_computer_default_modal;
    }
  }

  async updateHomeDashboardPreferences(req, res) {
    const userId = Number(req.session?.user?.id);
    if (!userId) {
      throw new Error('Usuario logado nao encontrado.');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario nao encontrado.');
    }

    const empresasFiltro = await this.getEmpresasFiltro();
    user.home_dashboard_preferences = this.serializeHomeDashboardPreferences(
      this.extractHomeDashboardPreferences(req.body),
      empresasFiltro
    );

    await user.save();
  }

  ensureAdmin(req) {
    if (req.session?.user?.role !== 'admin') {
      throw new Error('Apenas administradores podem gerenciar usuarios.');
    }
  }

  normalizeRole(role) {
    const normalized = String(role || 'tecnico').trim().toLowerCase();
    if (!ROLES_PERMITIDOS.includes(normalized)) {
      throw new Error('Perfil de usuario invalido.');
    }
    return normalized;
  }

  normalizeAddComputerDefaultModal(value) {
    const normalized = String(value || 'structured').trim().toLowerCase();
    return ADD_COMPUTER_DEFAULT_MODALS.includes(normalized) ? normalized : 'structured';
  }

  normalizeChartOrder(order) {
    const list = Array.isArray(order) ? order.map((item) => String(item || '').trim()) : [];
    const valid = list.filter((item) => HOME_DASHBOARD_CHART_IDS.includes(item));
    const unique = [];

    valid.forEach((item) => {
      if (!unique.includes(item)) unique.push(item);
    });

    HOME_DASHBOARD_CHART_IDS.forEach((item) => {
      if (!unique.includes(item)) unique.push(item);
    });

    return unique.slice(0, HOME_DASHBOARD_CHART_IDS.length);
  }

  normalizeHomeDashboardPreferences(value, empresasFiltro = []) {
    let parsed = value;

    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (error) {
        parsed = {};
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      parsed = {};
    }

    const empresas = Array.isArray(empresasFiltro) ? empresasFiltro : [];
    const allEmpresaIds = empresas
      .map((empresa) => Number(empresa.id))
      .filter((id) => Number.isFinite(id));
    const allEmpresaIdsSet = new Set(allEmpresaIds);
    const defaultRankingIds = empresas
      .filter((empresa) => !empresa.isDeptoTi)
      .map((empresa) => Number(empresa.id))
      .filter((id) => Number.isFinite(id));

    const normalizeEmpresaIds = (ids, fallback) => {
      const input = Array.isArray(ids) ? ids : [ids];
      const unique = [];

      input
        .map((item) => Number(item))
        .filter((id) => Number.isFinite(id) && allEmpresaIdsSet.has(id))
        .forEach((id) => {
          if (!unique.includes(id)) unique.push(id);
        });

      return unique.length ? unique : [...fallback];
    };

    return {
      ranking: normalizeEmpresaIds(parsed.ranking, defaultRankingIds),
      maquinas: normalizeEmpresaIds(parsed.maquinas, allEmpresaIds),
      order: this.normalizeChartOrder(parsed.order),
    };
  }

  serializeHomeDashboardPreferences(value, empresasFiltro = []) {
    return JSON.stringify(this.normalizeHomeDashboardPreferences(value, empresasFiltro));
  }

  extractHomeDashboardPreferences(body = {}) {
    return {
      ranking: body.homeRankingEmpresaIds,
      maquinas: body.homeMaquinasEmpresaIds,
      order: [
        body.homeChartOrderFirst,
        body.homeChartOrderSecond,
        body.homeChartOrderThird,
        body.homeChartOrderFourth,
      ],
    };
  }

  async getEmpresasFiltro() {
    const empresas = await Empresa.findAll({
      attributes: ['id', 'nome', 'sigla'],
      order: EmpresaController.getOrderClause(),
    });

    return (empresas || []).map((empresa) => ({
      id: Number(empresa.id),
      nomeCompleto: empresa.nome || 'Sem empresa',
      nome: empresa.sigla || empresa.nome || 'Sem empresa',
      isDeptoTi:
        String(empresa.sigla || '').trim().toUpperCase() === 'DEPTO TI' ||
        String(empresa.nome || '').trim().toUpperCase().includes('DEPARTAMENTO DE TI'),
    }));
  }

  async ensureUniqueUserFields({ nome, email, excludeId = null }) {
    const whereClause = {
      [Op.or]: [
        where(fn('LOWER', fn('TRIM', col('nome'))), String(nome).trim().toLowerCase()),
        where(fn('LOWER', fn('TRIM', col('email'))), String(email).trim().toLowerCase()),
      ],
    };

    if (excludeId) {
      whereClause.id = { [Op.ne]: Number(excludeId) };
    }

    const existing = await User.findOne({ where: whereClause });
    if (!existing) return;

    if (String(existing.nome || '').trim().toLowerCase() === String(nome).trim().toLowerCase()) {
      throw new Error('Ja existe um usuario com esse login/nome.');
    }

    throw new Error('Ja existe um usuario com esse email.');
  }
}

module.exports = AuthController;
