export interface CommercialBrief {
  sourceUrl: string;
  capturedAt: string;
  usage: string;
  genre?: string;
  budget?: string;
}

export interface OpportunityProvider {
  extractBrief(url: string): Promise<CommercialBrief>;
}
