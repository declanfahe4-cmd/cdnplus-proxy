FROM mcr.microsoft.com/playwright:v1.48.0-noble

WORKDIR /app

COPY package*.json ./

RUN npm ci

# المتصفح هينزل هنا مرة واحدة ويبقى إلى الأبد
RUN npx playwright install --with-deps chromium

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
