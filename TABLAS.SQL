
/****** Object:  Table [dbo].[Accesos]    Script Date: 25/12/2025 17:55:30 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Accesos](
	[codacc] [char](2) NOT NULL,
	[desacc] [varchar](80) NULL,
 CONSTRAINT [PK_Accesos] PRIMARY KEY CLUSTERED 
(
	[codacc] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Amortizacion]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Amortizacion](
	[idamort] [int] IDENTITY(1,1) NOT NULL,
	[iddeuda] [int] NOT NULL,
	[monto] [decimal](10, 2) NOT NULL,
	[codtipopago] [char](2) NOT NULL,
	[idusu] [int] NOT NULL,
	[idcaja] [int] NOT NULL,
	[feccre] [datetime] NOT NULL,
	[obs] [varchar](255) NULL,
 CONSTRAINT [PK_Amortizacion] PRIMARY KEY CLUSTERED 
(
	[idamort] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Anuncio]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Anuncio](
	[idanuncio] [int] IDENTITY(1,1) NOT NULL,
	[desc_anuncio] [varchar](250) NULL,
	[tipanuncio_id] [int] NULL,
	[mensaje] [nvarchar](max) NULL,
	[tiparch_id] [int] NULL,
	[ruta_arch] [varchar](100) NULL,
	[estado] [char](1) NULL,
	[feccre] [datetime] NULL,
	[fecmov] [datetime] NULL,
	[fecanu] [datetime] NULL,
	[idusu] [int] NULL,
	[idusu_anu] [int] NULL,
 CONSTRAINT [PK_Anuncio] PRIMARY KEY CLUSTERED 
(
	[idanuncio] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Anuncio_det]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Anuncio_det](
	[idanuncio_det] [int] IDENTITY(1,1) NOT NULL,
	[idanuncio] [int] NULL,
	[nombre] [varchar](250) NULL,
	[dniusu] [varchar](20) NULL,
	[contacusu] [varchar](25) NULL,
	[estado] [char](1) NULL,
	[idusu] [int] NULL,
	[feccre] [datetime] NULL,
	[fecmov] [datetime] NULL,
	[idMsg] [int] NULL,
 CONSTRAINT [PK_Anuncio_det] PRIMARY KEY CLUSTERED 
(
	[idanuncio_det] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Anuncio_programacion]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Anuncio_programacion](
	[idanuncio_prog] [int] IDENTITY(1,1) NOT NULL,
	[idanuncio] [int] NULL,
	[horini] [time](0) NULL,
	[horfin] [time](0) NULL,
	[fecini] [date] NULL,
	[idusu] [int] NULL,
	[feccre] [datetime] NULL,
	[fecmov] [datetime] NULL,
	[estado] [char](1) NULL,
 CONSTRAINT [PK_Anuncio_programacion] PRIMARY KEY CLUSTERED 
(
	[idanuncio_prog] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Asistencia]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Asistencia](
	[idasis] [int] IDENTITY(1,1) NOT NULL,
	[fecasis] [datetime] NOT NULL,
	[idusu] [int] NULL,
	[staasis] [char](1) NOT NULL,
 CONSTRAINT [PK__Asistenc__5E721450075C59EF] PRIMARY KEY CLUSTERED 
(
	[idasis] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Auditoria]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Auditoria](
	[idAuditoria] [int] IDENTITY(1,1) NOT NULL,
	[idMemdet] [int] NULL,
	[idusu] [int] NULL,
	[idMem] [int] NULL,
	[idBen] [int] NULL,
	[feccre] [datetime] NULL,
	[obs] [varchar](max) NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Beneficio]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Beneficio](
	[idben] [int] IDENTITY(1,1) NOT NULL,
	[desben] [varchar](15) NOT NULL,
	[cantben] [int] NOT NULL,
	[UsoBen] [int] NULL,
	[estben] [varchar](2) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[fecmv] [datetime] NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BeneficioProducto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BeneficioProducto](
	[idBenPro] [int] IDENTITY(1,1) NOT NULL,
	[barcpro] [varchar](100) NOT NULL,
	[idBen] [int] NOT NULL,
	[stabenpro] [char](1) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[idusu] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Caja]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Caja](
	[idcaja] [int] IDENTITY(1,1) NOT NULL,
	[apertura] [datetime] NULL,
	[cierre] [datetime] NULL,
	[montinicaja] [decimal](10, 2) NULL,
	[montfincaja] [decimal](10, 2) NULL,
	[idusu] [int] NULL,
 CONSTRAINT [PK__Caja__C9AC57919E7A2A14] PRIMARY KEY CLUSTERED 
(
	[idcaja] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CajaGasto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CajaGasto](
	[idgascaja] [int] IDENTITY(1,1) NOT NULL,
	[montcaja] [decimal](10, 2) NULL,
	[descaja] [varchar](200) NULL,
	[feccre] [datetime] NULL,
	[idusu] [int] NULL,
	[idcaja] [int] NULL,
 CONSTRAINT [PK_CajaGasto] PRIMARY KEY CLUSTERED 
(
	[idgascaja] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CallCenter_Cabecera]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CallCenter_Cabecera](
	[idcallcab] [int] IDENTITY(1,1) NOT NULL,
	[feccorte] [date] NOT NULL,
	[secini] [int] NULL,
	[descallcab] [varchar](255) NOT NULL,
	[glosacallcab] [varchar](max) NULL,
	[idusu_gen] [int] NOT NULL,
	[feccre] [datetime] NOT NULL,
	[fecmod] [datetime] NULL,
	[estcallcab] [char](1) NOT NULL,
 CONSTRAINT [PK_CallCenter_Cabecera] PRIMARY KEY CLUSTERED 
(
	[idcallcab] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CallCenter_Detalle]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CallCenter_Detalle](
	[idcalldet] [int] IDENTITY(1,1) NOT NULL,
	[idcallcab] [int] NOT NULL,
	[idcli] [int] NOT NULL,
	[dnicli] [varchar](20) NULL,
	[celcli] [varchar](15) NULL,
	[nomcli] [varchar](100) NULL,
	[mailcli] [varchar](50) NULL,
	[estllam] [char](1) NOT NULL,
	[idtipoope] [int] NULL,
	[obscalldet] [varchar](max) NULL,
	[feccre] [datetime] NOT NULL,
	[fecmov] [datetime] NULL,
	[idusu_ges] [int] NULL,
	[estreg] [char](1) NOT NULL,
	[fec_reprogramacion] [datetime] NULL,
	[id_venta] [int] NULL,
 CONSTRAINT [PK_CallCenter_Detalle] PRIMARY KEY CLUSTERED 
(
	[idcalldet] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CallCenter_TipoFiltro]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CallCenter_TipoFiltro](
	[idtipfil] [char](2) NOT NULL,
	[destipfil] [varchar](100) NOT NULL,
	[esttipfil] [char](1) NOT NULL,
 CONSTRAINT [PK_CallCenter_TipoFiltro] PRIMARY KEY CLUSTERED 
(
	[idtipfil] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CallCenter_TipoOperacion]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CallCenter_TipoOperacion](
	[idtipoope] [int] IDENTITY(1,1) NOT NULL,
	[destipoope] [varchar](100) NOT NULL,
	[esttipoope] [char](1) NOT NULL,
 CONSTRAINT [PK_CallCenter_TipoOperacion] PRIMARY KEY CLUSTERED 
(
	[idtipoope] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CategoriaGasto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CategoriaGasto](
	[codCategoria] [char](2) NOT NULL,
	[desccatgasto] [varchar](50) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[idusu] [int] NOT NULL,
	[estado] [char](1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[codCategoria] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Deuda]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Deuda](
	[iddeuda] [int] IDENTITY(1,1) NOT NULL,
	[idven] [int] NOT NULL,
	[idmem] [int] NULL,
	[dniusu] [varchar](20) NOT NULL,
	[monto_total] [decimal](10, 2) NOT NULL,
	[monto_pendiente] [decimal](10, 2) NOT NULL,
	[estado] [char](1) NOT NULL,
	[idusuven] [int] NOT NULL,
	[idcaja_origen] [int] NOT NULL,
	[feccre] [datetime] NOT NULL,
	[feccancel] [datetime] NULL,
	[fecvenc] [datetime] NULL,
 CONSTRAINT [PK_Deuda] PRIMARY KEY CLUSTERED 
(
	[iddeuda] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DispositivoLector]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DispositivoLector](
	[idlec] [int] IDENTITY(1,1) NOT NULL,
	[serlec] [varchar](50) NULL,
	[verlec] [char](1) NULL,
	[stalec] [char](1) NULL,
	[asisreglec] [char](1) NULL,
	[useragentlec] [varchar](300) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[estado_anunciodet]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[estado_anunciodet](
	[estado] [char](1) NOT NULL,
	[desc_estado] [varchar](50) NULL,
	[feccre] [datetime] NULL,
 CONSTRAINT [PK_estado_anunciodet] PRIMARY KEY CLUSTERED 
(
	[estado] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[estados_membresia]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[estados_membresia](
	[estamem] [char](1) NULL,
	[descmem] [varchar](20) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Gasto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Gasto](
	[idGasto] [int] IDENTITY(1,1) NOT NULL,
	[idTipoGasto] [int] NOT NULL,
	[codtipopago] [char](2) NOT NULL,
	[monto] [decimal](12, 2) NOT NULL,
	[descripcion] [varchar](255) NULL,
	[fecgasto] [date] NOT NULL,
	[feccre] [datetime] NOT NULL,
	[fecmov] [datetime] NOT NULL,
	[idusu] [int] NOT NULL,
	[estado] [char](1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idGasto] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[GastoBancario]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GastoBancario](
	[idGastoBancario] [int] IDENTITY(1,1) NOT NULL,
	[idGasto] [int] NOT NULL,
	[gbBanco] [varchar](100) NOT NULL,
	[gbFecpago] [datetime] NOT NULL,
	[gbDesc] [varchar](255) NULL,
	[feccre] [datetime] NOT NULL,
	[fecmov] [datetime] NOT NULL,
	[idusu] [int] NOT NULL,
	[estado] [char](1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idGastoBancario] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[GastoPlanilla]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GastoPlanilla](
	[idGastoPlanilla] [int] IDENTITY(1,1) NOT NULL,
	[idGasto] [int] NOT NULL,
	[gpPersonal] [varchar](100) NOT NULL,
	[gpMonto] [decimal](12, 2) NOT NULL,
	[gpFecpago] [datetime] NOT NULL,
	[gpPeriodo] [varchar](50) NULL,
	[feccre] [datetime] NOT NULL,
	[fecmov] [datetime] NOT NULL,
	[idusu] [int] NOT NULL,
	[estado] [char](1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idGastoPlanilla] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Genero]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Genero](
	[codgen] [char](1) NOT NULL,
	[desgen] [varchar](10) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Horario]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Horario](
	[idhora] [int] IDENTITY(1,1) NOT NULL,
	[hora] [time](7) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Huella]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Huella](
	[idhue] [int] IDENTITY(1,1) NOT NULL,
	[idusu] [int] NULL,
	[deshue] [varbinary](max) NULL,
	[stahue] [char](1) NULL,
	[conthue] [int] NULL,
	[fecrre] [datetime] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Membresia]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Membresia](
	[idmem] [int] IDENTITY(1,1) NOT NULL,
	[fecinimem] [date] NULL,
	[fecfinmem] [date] NULL,
	[diasmem] [int] NOT NULL,
	[diasstock] [int] NOT NULL,
	[ingmem] [int] NOT NULL,
	[idtipomem] [int] NOT NULL,
	[dniusutit] [varchar](20) NULL,
	[dniusudep] [varchar](20) NULL,
	[barcpro] [varchar](50) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[idusumem] [int] NOT NULL,
	[estamem] [char](1) NOT NULL,
	[codsta] [char](1) NULL,
	[fecmv] [datetime] NULL,
	[idven] [int] NULL,
	[estado_deuda] [char](1) NULL,
 CONSTRAINT [PK__Membresi__0577FDB0E0D9606A] PRIMARY KEY CLUSTERED 
(
	[idmem] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MembresiaDetalle]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MembresiaDetalle](
	[idMemdet] [int] IDENTITY(1,1) NOT NULL,
	[idMem] [int] NULL,
	[idBen] [int] NULL,
	[Cant] [int] NULL,
	[CantBen] [int] NULL,
	[UsoBen] [int] NULL,
	[dniusu] [varchar](20) NULL,
	[idusuven] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[mensajes_auditoria]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[mensajes_auditoria](
	[idMsg] [int] IDENTITY(1,1) NOT NULL,
	[idTabla] [int] NULL,
	[tabla] [varchar](80) NULL,
	[idMsg_api] [int] NULL,
	[celular] [varchar](25) NULL,
	[body] [varchar](max) NULL,
	[sent] [varchar](50) NULL,
	[status] [varchar](50) NULL,
	[created_at] [datetime] NULL,
	[sent_at] [datetime] NULL,
	[idusu] [int] NULL,
	[usenam] [varchar](50) NULL,
	[feccre] [datetime] NULL,
	[estado] [char](1) NULL,
 CONSTRAINT [PK_mensajes_auditoria] PRIMARY KEY CLUSTERED 
(
	[idMsg] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MovimientoProducto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MovimientoProducto](
	[idmov] [int] IDENTITY(1,1) NOT NULL,
	[idtipomov] [varchar](15) NOT NULL,
	[idpro] [int] NOT NULL,
	[cantmov] [decimal](10, 2) NOT NULL,
	[coscom] [decimal](10, 2) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[idprov] [int] NOT NULL,
	[idusu] [int] NOT NULL,
	[fecmv] [datetime] NOT NULL,
	[estmov] [varchar](2) NOT NULL,
 CONSTRAINT [PK__Movimien__0577AC4DC5B2261F] PRIMARY KEY CLUSTERED 
(
	[idmov] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Producto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Producto](
	[idpro] [int] IDENTITY(1,1) NOT NULL,
	[despro] [varchar](150) NOT NULL,
	[picpro] [varchar](100) NOT NULL,
	[cosvenpro] [decimal](10, 2) NOT NULL,
	[barcpro] [varchar](100) NOT NULL,
	[idtipopro] [int] NOT NULL,
	[stock] [decimal](10, 2) NULL,
	[durpro] [int] NULL,
	[estpro] [varchar](2) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[fecmv] [datetime] NULL,
	[idusu] [int] NOT NULL,
 CONSTRAINT [PK__Producto__04B64501AD2B3FF9] PRIMARY KEY CLUSTERED 
(
	[idpro] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [barcpro] UNIQUE NONCLUSTERED 
(
	[barcpro] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ__Producto__5FE895FE0FC5BAF8] UNIQUE NONCLUSTERED 
(
	[picpro] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ__Producto__C12BBAF5041EE5AA] UNIQUE NONCLUSTERED 
(
	[barcpro] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Programacion]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Programacion](
	[idprog] [int] IDENTITY(1,1) NOT NULL,
	[idusu] [int] NOT NULL,
	[barcpro] [varchar](100) NOT NULL,
	[fecprog] [date] NOT NULL,
	[cuposprog] [int] NOT NULL,
	[idhoraini] [int] NOT NULL,
	[idhorafin] [int] NOT NULL,
	[cuposrest] [int] NOT NULL,
	[staprog] [char](1) NOT NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Proveedores]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Proveedores](
	[idprov] [int] IDENTITY(1,1) NOT NULL,
	[desprov] [varchar](100) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[estprov] [varchar](2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idprov] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Regla]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Regla](
	[idregla] [int] IDENTITY(1,1) NOT NULL,
	[idrol] [int] NULL,
	[codacc] [char](2) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Reserva]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Reserva](
	[idres] [int] IDENTITY(1,1) NOT NULL,
	[idusu] [int] NULL,
	[idprog] [int] NOT NULL,
	[stares] [char](1) NOT NULL,
	[feccre] [datetime] NULL,
	[idven] [int] NULL,
	[dniusucli] [varchar](20) NULL,
	[nomcli] [varchar](100) NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rol]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rol](
	[idrol] [int] IDENTITY(1,1) NOT NULL,
	[desrol] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idrol] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Sessions]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sessions](
	[session_id] [nvarchar](32) NOT NULL,
	[expires] [datetimeoffset](7) NULL,
	[data] [nvarchar](max) NULL,
	[createdAt] [datetimeoffset](7) NOT NULL,
	[updatedAt] [datetimeoffset](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[session_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tipo_anuncio]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tipo_anuncio](
	[tipanuncio_id] [int] NOT NULL,
	[des_tipo_anuncio] [varchar](50) NULL,
	[estado] [char](1) NULL,
	[usenam] [varchar](30) NULL,
	[feccre] [datetime] NULL,
	[fecmov] [datetime] NULL,
 CONSTRAINT [PK_tipo_anuncio] PRIMARY KEY CLUSTERED 
(
	[tipanuncio_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tipo_archivo]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tipo_archivo](
	[tiparch_id] [int] NOT NULL,
	[destipdoc] [varchar](50) NULL,
	[extension] [char](10) NULL,
	[estado] [char](1) NULL,
	[usenam] [varchar](30) NULL,
	[feccre] [datetime] NULL,
	[fecmov] [datetime] NULL,
 CONSTRAINT [PK_tipo_archivo] PRIMARY KEY CLUSTERED 
(
	[tiparch_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TipoGasto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TipoGasto](
	[idTipoGasto] [int] IDENTITY(1,1) NOT NULL,
	[desctipgasto] [varchar](100) NOT NULL,
	[codCategoria] [char](2) NOT NULL,
	[feccre] [datetime] NOT NULL,
	[idusu] [int] NOT NULL,
	[estado] [char](1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idTipoGasto] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TipoMembresia]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TipoMembresia](
	[idtipomem] [int] IDENTITY(1,1) NOT NULL,
	[destipomem] [varchar](50) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idtipomem] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TipoMovimiento]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TipoMovimiento](
	[idtipomov] [int] IDENTITY(1,1) NOT NULL,
	[destipomov] [varchar](15) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idtipomov] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TipoPago]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TipoPago](
	[codtipopago] [char](2) NOT NULL,
	[destipopago] [varchar](15) NOT NULL,
	[esdigital] [char](1) NOT NULL,
	[estado] [char](1) NOT NULL,
 CONSTRAINT [PK_TipoPago] PRIMARY KEY CLUSTERED 
(
	[codtipopago] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TipoProducto]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TipoProducto](
	[idtipopro] [int] IDENTITY(1,1) NOT NULL,
	[destipopro] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK__TipoProd__A9DF0320D736B6FF] PRIMARY KEY CLUSTERED 
(
	[idtipopro] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[usuario]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[usuario](
	[idusu] [int] IDENTITY(1,1) NOT NULL,
	[nomusu] [varchar](50) NOT NULL,
	[apellusu] [varchar](50) NOT NULL,
	[dniusu] [varchar](20) NOT NULL,
	[passusu] [varchar](max) NOT NULL,
	[fecnacusu] [date] NOT NULL,
	[prefix_pais] [varchar](5) NULL,
	[contacusu] [varchar](15) NOT NULL,
	[mailusu] [varchar](50) NOT NULL,
	[estusu] [char](1) NOT NULL,
	[estintrausu] [char](1) NOT NULL,
	[picusu] [varchar](max) NULL,
	[codgen] [char](1) NOT NULL,
	[idrol] [int] NOT NULL,
	[idusu_reg] [int] NULL,
	[feccre] [datetime] NULL,
	[idusu_mv] [int] NULL,
	[fecmv] [datetime] NULL,
 CONSTRAINT [PK__usuario__250C90F52479DF8B] PRIMARY KEY CLUSTERED 
(
	[idusu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [Usuario_UQ_1] UNIQUE NONCLUSTERED 
(
	[dniusu] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Venta]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Venta](
	[idven] [int] IDENTITY(1,1) NOT NULL,
	[dniusu] [varchar](20) NULL,
	[codtipopago] [varchar](2) NULL,
	[subtotalven] [decimal](10, 2) NULL,
	[descven] [decimal](10, 2) NULL,
	[totalven] [decimal](10, 2) NULL,
	[cantpagven] [decimal](10, 2) NULL,
	[cambioven] [decimal](10, 2) NULL,
	[estven] [varchar](2) NULL,
	[feccre] [datetime] NULL,
	[idusuven] [int] NULL,
	[idcaja] [int] NULL,
 CONSTRAINT [PK__Venta__25CD246DDA04C9DD] PRIMARY KEY CLUSTERED 
(
	[idven] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VentaDetalle]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VentaDetalle](
	[idvendet] [int] IDENTITY(1,1) NOT NULL,
	[idven] [int] NULL,
	[barcpro] [varchar](100) NULL,
	[cantvendet] [int] NULL,
	[cospro] [decimal](10, 2) NULL,
	[fecini] [date] NULL,
	[subtotal] [decimal](10, 2) NULL,
	[dniusucli] [varchar](20) NULL,
	[feccre] [datetime] NULL,
	[idusuven] [int] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VentaPagos]    Script Date: 25/12/2025 17:55:31 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VentaPagos](
	[idvenpago] [int] IDENTITY(1,1) NOT NULL,
	[idven] [int] NOT NULL,
	[codtipopago] [char](2) NOT NULL,
	[monto] [decimal](10, 2) NOT NULL,
	[feccre] [datetime] NULL,
	[cambio] [decimal](10, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[idvenpago] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Amortizacion] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[CallCenter_TipoFiltro] ADD  DEFAULT ('S') FOR [esttipfil]
GO
ALTER TABLE [dbo].[CallCenter_TipoOperacion] ADD  DEFAULT ('S') FOR [esttipoope]
GO
ALTER TABLE [dbo].[CategoriaGasto] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[CategoriaGasto] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[Deuda] ADD  DEFAULT ('A') FOR [estado]
GO
ALTER TABLE [dbo].[Deuda] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[Gasto] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[Gasto] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[GastoBancario] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[GastoBancario] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[GastoPlanilla] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[GastoPlanilla] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[TipoGasto] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[TipoGasto] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[TipoPago] ADD  DEFAULT ('N') FOR [esdigital]
GO
ALTER TABLE [dbo].[TipoPago] ADD  DEFAULT ('S') FOR [estado]
GO
ALTER TABLE [dbo].[VentaPagos] ADD  DEFAULT (getdate()) FOR [feccre]
GO
ALTER TABLE [dbo].[VentaPagos] ADD  DEFAULT ((0.00)) FOR [cambio]
GO
ALTER TABLE [dbo].[Amortizacion]  WITH CHECK ADD  CONSTRAINT [FK_Amortizacion_Caja] FOREIGN KEY([idcaja])
REFERENCES [dbo].[Caja] ([idcaja])
GO
ALTER TABLE [dbo].[Amortizacion] CHECK CONSTRAINT [FK_Amortizacion_Caja]
GO
ALTER TABLE [dbo].[Amortizacion]  WITH CHECK ADD  CONSTRAINT [FK_Amortizacion_Deuda] FOREIGN KEY([iddeuda])
REFERENCES [dbo].[Deuda] ([iddeuda])
GO
ALTER TABLE [dbo].[Amortizacion] CHECK CONSTRAINT [FK_Amortizacion_Deuda]
GO
ALTER TABLE [dbo].[Amortizacion]  WITH CHECK ADD  CONSTRAINT [FK_Amortizacion_TipoPago] FOREIGN KEY([codtipopago])
REFERENCES [dbo].[TipoPago] ([codtipopago])
GO
ALTER TABLE [dbo].[Amortizacion] CHECK CONSTRAINT [FK_Amortizacion_TipoPago]
GO
ALTER TABLE [dbo].[Amortizacion]  WITH CHECK ADD  CONSTRAINT [FK_Amortizacion_Usuario] FOREIGN KEY([idusu])
REFERENCES [dbo].[usuario] ([idusu])
GO
ALTER TABLE [dbo].[Amortizacion] CHECK CONSTRAINT [FK_Amortizacion_Usuario]
GO
ALTER TABLE [dbo].[CallCenter_Cabecera]  WITH CHECK ADD  CONSTRAINT [FK_CallCenter_Cabecera_Usuario] FOREIGN KEY([idusu_gen])
REFERENCES [dbo].[usuario] ([idusu])
GO
ALTER TABLE [dbo].[CallCenter_Cabecera] CHECK CONSTRAINT [FK_CallCenter_Cabecera_Usuario]
GO
ALTER TABLE [dbo].[CallCenter_Detalle]  WITH CHECK ADD  CONSTRAINT [FK_CallCenter_Detalle_Cabecera] FOREIGN KEY([idcallcab])
REFERENCES [dbo].[CallCenter_Cabecera] ([idcallcab])
GO
ALTER TABLE [dbo].[CallCenter_Detalle] CHECK CONSTRAINT [FK_CallCenter_Detalle_Cabecera]
GO
ALTER TABLE [dbo].[CallCenter_Detalle]  WITH CHECK ADD  CONSTRAINT [FK_CallCenter_Detalle_Cliente] FOREIGN KEY([idcli])
REFERENCES [dbo].[usuario] ([idusu])
GO
ALTER TABLE [dbo].[CallCenter_Detalle] CHECK CONSTRAINT [FK_CallCenter_Detalle_Cliente]
GO
ALTER TABLE [dbo].[CallCenter_Detalle]  WITH CHECK ADD  CONSTRAINT [FK_CallCenter_Detalle_UsuarioGestion] FOREIGN KEY([idusu_ges])
REFERENCES [dbo].[usuario] ([idusu])
GO
ALTER TABLE [dbo].[CallCenter_Detalle] CHECK CONSTRAINT [FK_CallCenter_Detalle_UsuarioGestion]
GO
ALTER TABLE [dbo].[CallCenter_Detalle]  WITH CHECK ADD  CONSTRAINT [FK_CallCenter_Detalle_Venta] FOREIGN KEY([id_venta])
REFERENCES [dbo].[Venta] ([idven])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[CallCenter_Detalle] CHECK CONSTRAINT [FK_CallCenter_Detalle_Venta]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [FK_Deuda_Caja] FOREIGN KEY([idcaja_origen])
REFERENCES [dbo].[Caja] ([idcaja])
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [FK_Deuda_Caja]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [FK_Deuda_Membresia] FOREIGN KEY([idmem])
REFERENCES [dbo].[Membresia] ([idmem])
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [FK_Deuda_Membresia]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [FK_Deuda_Usuario] FOREIGN KEY([idusuven])
REFERENCES [dbo].[usuario] ([idusu])
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [FK_Deuda_Usuario]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [FK_Deuda_Venta] FOREIGN KEY([idven])
REFERENCES [dbo].[Venta] ([idven])
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [FK_Deuda_Venta]
GO
ALTER TABLE [dbo].[Gasto]  WITH CHECK ADD FOREIGN KEY([codtipopago])
REFERENCES [dbo].[TipoPago] ([codtipopago])
GO
ALTER TABLE [dbo].[Gasto]  WITH CHECK ADD FOREIGN KEY([idTipoGasto])
REFERENCES [dbo].[TipoGasto] ([idTipoGasto])
GO
ALTER TABLE [dbo].[GastoBancario]  WITH CHECK ADD FOREIGN KEY([idGasto])
REFERENCES [dbo].[Gasto] ([idGasto])
GO
ALTER TABLE [dbo].[GastoPlanilla]  WITH CHECK ADD FOREIGN KEY([idGasto])
REFERENCES [dbo].[Gasto] ([idGasto])
GO
ALTER TABLE [dbo].[TipoGasto]  WITH CHECK ADD FOREIGN KEY([codCategoria])
REFERENCES [dbo].[CategoriaGasto] ([codCategoria])
GO
ALTER TABLE [dbo].[VentaPagos]  WITH CHECK ADD  CONSTRAINT [FK_VentaPagos_TipoPago] FOREIGN KEY([codtipopago])
REFERENCES [dbo].[TipoPago] ([codtipopago])
GO
ALTER TABLE [dbo].[VentaPagos] CHECK CONSTRAINT [FK_VentaPagos_TipoPago]
GO
ALTER TABLE [dbo].[VentaPagos]  WITH CHECK ADD  CONSTRAINT [FK_VentaPagos_Venta] FOREIGN KEY([idven])
REFERENCES [dbo].[Venta] ([idven])
GO
ALTER TABLE [dbo].[VentaPagos] CHECK CONSTRAINT [FK_VentaPagos_Venta]
GO
ALTER TABLE [dbo].[Amortizacion]  WITH CHECK ADD  CONSTRAINT [CK_Amortizacion_Monto] CHECK  (([monto]>(0)))
GO
ALTER TABLE [dbo].[Amortizacion] CHECK CONSTRAINT [CK_Amortizacion_Monto]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [CK_Deuda_Estado] CHECK  (([estado]='V' OR [estado]='C' OR [estado]='A'))
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [CK_Deuda_Estado]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [CK_Deuda_MontoPendiente] CHECK  (([monto_pendiente]>=(0)))
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [CK_Deuda_MontoPendiente]
GO
ALTER TABLE [dbo].[Deuda]  WITH CHECK ADD  CONSTRAINT [CK_Deuda_MontoTotal] CHECK  (([monto_total]>(0)))
GO
ALTER TABLE [dbo].[Deuda] CHECK CONSTRAINT [CK_Deuda_MontoTotal]
GO
ALTER TABLE [dbo].[Membresia]  WITH CHECK ADD  CONSTRAINT [CK_Membresia_EstadoDeuda] CHECK  (([estado_deuda]='C' OR [estado_deuda]='N' OR [estado_deuda]='D' OR [estado_deuda] IS NULL))
GO
ALTER TABLE [dbo].[Membresia] CHECK CONSTRAINT [CK_Membresia_EstadoDeuda]
GO
ALTER TABLE [dbo].[TipoPago]  WITH CHECK ADD  CONSTRAINT [CK_TipoPago_EsDigital] CHECK  (([esdigital]='N' OR [esdigital]='S'))
GO
ALTER TABLE [dbo].[TipoPago] CHECK CONSTRAINT [CK_TipoPago_EsDigital]
GO
ALTER TABLE [dbo].[TipoPago]  WITH CHECK ADD  CONSTRAINT [CK_TipoPago_Estado] CHECK  (([estado]='N' OR [estado]='S'))
GO
ALTER TABLE [dbo].[TipoPago] CHECK CONSTRAINT [CK_TipoPago_Estado]
GO
ALTER TABLE [dbo].[VentaPagos]  WITH CHECK ADD  CONSTRAINT [CK_VentaPagos_Cambio] CHECK  (([cambio]>=(0)))
GO
ALTER TABLE [dbo].[VentaPagos] CHECK CONSTRAINT [CK_VentaPagos_Cambio]
GO
ALTER TABLE [dbo].[VentaPagos]  WITH CHECK ADD  CONSTRAINT [CK_VentaPagos_Monto] CHECK  (([monto]>=(0)))
GO
ALTER TABLE [dbo].[VentaPagos] CHECK CONSTRAINT [CK_VentaPagos_Monto]
GO
