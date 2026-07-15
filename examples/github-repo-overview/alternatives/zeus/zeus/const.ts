/* eslint-disable */

export const AllTypesProps: Record<string,any> = {
	URI: `scalar.URI` as const,
	DateTime: `scalar.DateTime` as const,
	Query:{
		repository:{

		}
	},
	Repository:{
		issues:{
			states:"IssueState"
		}
	},
	IssueState: "enum" as const,
	ID: `scalar.ID` as const
}

export const ReturnTypes: Record<string,any> = {
	URI: `scalar.URI` as const,
	DateTime: `scalar.DateTime` as const,
	Query:{
		repository:"Repository"
	},
	Repository:{
		name:"String",
		nameWithOwner:"String",
		description:"String",
		url:"URI",
		isPrivate:"Boolean",
		stargazerCount:"Int",
		forkCount:"Int",
		primaryLanguage:"Language",
		licenseInfo:"License",
		issues:"IssueConnection",
		latestRelease:"Release"
	},
	Language:{
		name:"String"
	},
	License:{
		name:"String",
		spdxId:"String"
	},
	Release:{
		name:"String",
		tagName:"String",
		url:"URI",
		publishedAt:"DateTime"
	},
	IssueConnection:{
		totalCount:"Int"
	},
	ID: `scalar.ID` as const
}

export const Ops = {
query: "Query" as const
}