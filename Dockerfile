FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data TZ=Asia/Kuala_Lumpur
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
