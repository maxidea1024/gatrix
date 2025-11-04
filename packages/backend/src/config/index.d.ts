declare const config: {
    port: number;
    nodeEnv: string;
    corsOrigin: string;
    frontendUrl: string;
    database: {
        host: string;
        port: number;
        user: string;
        password: string;
        name: string;
        debug: boolean;
    };
    redis: {
        host: string;
        port: number;
        password: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    session: {
        secret: string;
        maxAge: number;
        ttl: number;
    };
    oauth: {
        google: {
            clientId: string;
            clientSecret: string;
        };
        github: {
            clientId: string;
            clientSecret: string;
        };
        qq: {
            clientId: string;
            clientSecret: string;
        };
        wechat: {
            clientId: string;
            clientSecret: string;
        };
        baidu: {
            clientId: string;
            clientSecret: string;
        };
    };
    admin: {
        email: string;
        password: string;
        name: string;
    };
    logging: {
        level: string;
        dir: string;
    };
    chatServer: {
        url: string;
        apiToken: string;
    };
};
export { config };
export default config;
//# sourceMappingURL=index.d.ts.map