import { StyleSheet,} from 'react-native'

const styles = StyleSheet.create({
    container:{
        padding:10,
        backgroundColor:'#dddbdb',
        borderRadius:20,
        marginBottom:15,
    },
    subHeading:{
        fontSize:16,
        fontWeight:'bold'
    },
    detail:{
        fontSize:15,
        marginBottom:5,
    },
    priceTypeRow:{
        flexDirection:'row',
        justifyContent:'space-between',
        marginBottom:5,
    },
    priceType:{
        fontSize:15,
    },
    statusRow:{
        flexDirection:'row',
        alignItems:'center',
        gap:10,
    },
    greenIcon:{
        width:10,
        height:10,
        borderRadius:5,
        backgroundColor:'#03eb03',
    },
    redIcon:{
        width:10,
        height:10,
        borderRadius:5,
        backgroundColor:'#eb1e03',
    },
})

export default styles;
