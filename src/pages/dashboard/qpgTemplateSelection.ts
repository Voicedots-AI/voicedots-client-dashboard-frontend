import type {PaperTemplate} from './QpgTemplatesPanel';

export function matchingInstitutionTemplate(items:PaperTemplate[],institutionName:string){
 const institution=institutionName.trim().toLowerCase();
 return institution?items.find(item=>item.status==='ACTIVE'&&item.configuration.institution_name?.trim().toLowerCase()===institution):undefined;
}
