FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install

# Copy app source
COPY public/ public/
COPY src/ src/

EXPOSE 3001

ENV PORT=3001

CMD ["npm", "start"]
