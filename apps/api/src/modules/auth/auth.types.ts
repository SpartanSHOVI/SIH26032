export type Role='FARMER'|'CENTER_OPERATOR'|'ADMIN';
export interface Principal {sub:string;role:Role;farmerId?:string;centerId?:string;sid:string;demo?:boolean;}
