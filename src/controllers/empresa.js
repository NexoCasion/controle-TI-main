const Empresa = require("../models/Empresa");

class EmpresaController {
    async create(name, description) {
        try {
            if(!name) throw new Error("Favor informe um nome.")

            await Empresa.create({ nome: name, descricao: description });
        } catch (error) {
            throw new Error('Erro ao criar empresa: ' + error.message);
        }
    }

    async getAll() {
        try {
            const empresasList = await Empresa.findAll();
        
            const empresasJSON = empresasList.map(empresa => ({
                id: empresa.dataValues.id,
                nome: empresa.dataValues.nome,
                descricao: empresa.dataValues.descricao
            }));
            return empresasJSON;        
        } catch (error) {
            throw new Error('Erro ao buscar empresas: ' + error.message);
        }
    }
}

module.exports = EmpresaController;
