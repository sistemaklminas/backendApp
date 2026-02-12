// Em: src/types/express.d.ts

import { DecodedIdToken } from 'firebase-admin/auth';

// Estende a interface 'User' para incluir a propriedade 'role'
interface UserProfile extends DecodedIdToken {
    role?: 'admin' | 'parent' | 'user'; // Defina os roles que você usa
}

// Estende a interface 'Request' do Express
declare global {
    namespace Express {
        export namespace Multer {
            interface File {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                buffer: Buffer;
            }
        }

        export interface Request {
            user?: UserProfile; // Agora 'req.user' é um tipo conhecido
        }
    }
}
