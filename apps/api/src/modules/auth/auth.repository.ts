import {Inject,Injectable} from '@nestjs/common';
import {DatabaseService,first,rows} from '../../infrastructure/database/database.service';
@Injectable() export class AuthRepository {
 constructor(@Inject(DatabaseService) readonly db:DatabaseService){}
 account(login:string){return first(this.db,'SELECT * FROM app_accounts WHERE login=$1',login);}
 legacy(login:string,hash:string){return first(this.db,'SELECT * FROM farmers WHERE mobile=$1 OR farmer_id=$1 OR aadhaar_hash=$2 ORDER BY created_at LIMIT 1',login,hash);}
 accountForFarmer(id:string){return first(this.db,'SELECT * FROM app_accounts WHERE farmer_id=$1::uuid',id);}
 async session(id:string){return first(this.db,`SELECT s.*,a.role,a.farmer_id,a.center_id,a.demo FROM auth_sessions s JOIN app_accounts a ON a.id=s.account_id WHERE s.id=$1::uuid AND s.revoked_at IS NULL AND s.expires_at>now()`,id);}
 async revoke(id:string){await rows(this.db,'UPDATE auth_sessions SET revoked_at=now() WHERE id=$1::uuid RETURNING id',id);}
}
