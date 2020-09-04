FROM node:12.18-buster-slim
RUN apt-get update && apt-get install -y \
    git python unzip wget \
    && rm -rf /var/lib/apt/lists/*
RUN cd /tmp && wget https://github.com/emscripten-core/emsdk/archive/master.zip && \
    cd /opt && unzip /tmp/master.zip && rm /tmp/master.zip
RUN /opt/emsdk-master/emsdk update-tags && /opt/emsdk-master/emsdk install 1.39.19 && \
    /opt/emsdk-master/emsdk activate 1.39.19
