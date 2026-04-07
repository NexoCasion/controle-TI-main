const bcrypt = require('bcrypt');
const { Op, fn, col, where } = require('sequelize');
const User = require('../models/User');

const ROLES_PERMITIDOS = ['admin', 'tecnico'];

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
    }
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
