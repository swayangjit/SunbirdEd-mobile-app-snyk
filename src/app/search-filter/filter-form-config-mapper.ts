import { Injectable } from '@angular/core';
import { FilterValue } from '@project-sunbird/sunbird-sdk';
import { IFacetFilterFieldTemplateConfig } from 'common-form-elements';
import { SearchFilterService } from '../../services/search-filter/search-filter.service';
import { TranslateJsonPipe } from '../../pipes/translate-json/translate-json';

interface FilterFormConfigWithDefaults {
    config: IFacetFilterFieldTemplateConfig[];
    defaults: { [key: string]: string[] | string | undefined };
}

interface SearchFilterConfig {
    code: string,
    type: string,
    name: string,
    placeholder?: string,
    multiple?: boolean,
    index?: number,
    placeHolder?: string,
    alternativeCode?: string
}

@Injectable()
export class FilterFormConfigMapper {
    private searchFilterFormConfig: any[];

    constructor(
        private searchFilterService: SearchFilterService,
        private translateJsonPipe: TranslateJsonPipe
    ) {
        this.fetchSearchFormAPI();
    }

    private static buildDefault(filterValues: FilterValue[], multiple: boolean): string[] | string | undefined {
        if (multiple) {
            return filterValues
                .filter(f => f.apply)
                .map(f => f.name);
        } else {
            const filterValue = filterValues.find(f => f.apply);
            return filterValue && filterValue.name;
        }
    }

    private async fetchSearchFormAPI(){
        this.searchFilterFormConfig = await this.searchFilterService.getFacetFormAPIConfig();
    }

    async map(facetFilters: { [key: string]: FilterValue[] }, existingFilters={}): Promise<FilterFormConfigWithDefaults> {
        if(!this.searchFilterFormConfig || !this.searchFilterFormConfig.length){
            this.searchFilterFormConfig = await this.searchFilterService.getFacetFormAPIConfig();
        }
        const mappedFilters: FilterFormConfigWithDefaults = {config:[], defaults:{}};
        this.searchFilterFormConfig.sort((a, b)=>{
            if(a.index && b.index){
                return (a.index-b.index);
            }
            return 1;
        });
        this.searchFilterFormConfig.forEach((filterConfig:SearchFilterConfig) => {
            let facetCode = facetFilters[filterConfig.alternativeCode] ?  filterConfig.alternativeCode : filterConfig.code;
            if(facetCode && !(existingFilters[filterConfig.code] || existingFilters[filterConfig.alternativeCode])){
                mappedFilters.defaults[facetCode] = FilterFormConfigMapper.buildDefault(facetFilters[facetCode], filterConfig.multiple);
                mappedFilters.config.push({
                    facet: facetCode,
                    type: filterConfig.type ? filterConfig.type as ('dropdown' | 'pills') : 'dropdown',
                    labelText: this.translateJsonPipe.transform(filterConfig.name),
                    placeholderText: this.translateJsonPipe.transform(filterConfig.placeholder || filterConfig.placeHolder),
                    multiple: (filterConfig.multiple || true)
                });
            }
        });

        return mappedFilters;
    }

}