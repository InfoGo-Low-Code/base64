# Base64 - InfoGo

## Ideia
Baseado em uma necessidade de projetos da empresa **InfoGo**, decidimos criar um mini-módulo **Backend** em **JavaScript** para lidar com as demandas e necessidades de projetos.

## 🚀 Tecnologias
Esse projeto foi desenvolvido com as seguintes tecnologias:
- [TypeScript](https://www.typescriptlang.org)
- [Node.js](https://nodejs.org/en)
- [pnpm](https://pnpm.io)

## ⚙ Ferramentas e Dependências
Esse projeto utiliza as seguintes dependências e ferramentas:
- [Fastify](https://fastify.dev)
- [Zod](https://zod.dev)
- [Swagger](https://swagger.io)
- [Axios](https://axios-http.com)
- [ESLint](https://eslint.org)

## Licença
Esse projeto está sob a proteção da licença: CC BY-NC 4.0

Permissões:
- ✅ Uso pessoal e educacional
- ✅ Modificação e distribuição com atribuição
- ❌ Proíbe uso comercial

## 💻 Acesse o projeto local
### ✅ Requisitos
Antes de começar, você precisa ter o [Git](https://git-scm.com/downloads) e o [Node.js](https://nodejs.org/en/download) instalados.

```bash
# 1º Passo - Clonar o projeto localmente
git clone https://github.com/InfoGo-Low-Code/base64

# 2º Passo - Abrir a pasta do projeto
cd base64/

# 3º Passo - Instalar as dependências (com npm, yarn ou pnpm)
npm install
# ou
yarn install
# ou
pnpm install

# 4º Passo - Criar o arquivo .env com as variáveis necessárias
cp .env.example .env

# 5º Passo - Rodar o projeto com o comando 'dev', do package.json
npm run dev

# O servidor irá rodar, por padrão, na porta 3333 e será exibido no log:
# HTTP Server running on PORT 3333


# COMO SUBIR PARA O GCLOUD
gcloud run deploy infogo-back-base64 --source . --region southamerica-east1 --project checkgo-e8680 --env-vars-file env.yaml
```